"""Service for managing Spaced Repetition (FSRS) and Study Queues."""

import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

try:
    from fsrs import Scheduler as FSRS, Card, Rating, State
except ImportError:
    from fsrs import FSRS, Card, Rating, State

from app.core.config import Settings
from app.schemas.study import FlashcardReviewState
from app.services.storage.job_store import JobStore

logger = logging.getLogger(__name__)

class StudyService:
    def __init__(self, settings: Settings, job_store: JobStore):
        self.settings = settings
        self.job_store = job_store
        self.settings.storage_study.mkdir(parents=True, exist_ok=True)
        self.db_path = self.settings.storage_study / "study.db"
        self.fsrs = FSRS()
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS flashcard_reviews (
                    id TEXT PRIMARY KEY,
                    flashcard_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    state INTEGER NOT NULL,
                    due TIMESTAMP NOT NULL,
                    stability REAL NOT NULL,
                    difficulty REAL NOT NULL,
                    elapsed_days INTEGER NOT NULL,
                    scheduled_days INTEGER NOT NULL,
                    reps INTEGER NOT NULL,
                    lapses INTEGER NOT NULL,
                    priority REAL NOT NULL DEFAULT 0.5,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Phase 9D: Database Optimization Indexing
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_due ON flashcard_reviews(due)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_state ON flashcard_reviews(state)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_priority ON flashcard_reviews(priority DESC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reviews_job ON flashcard_reviews(job_id)")
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    daily_new_limit INTEGER DEFAULT 20,
                    daily_reviews_limit INTEGER DEFAULT 200
                )
            ''')
            # Insert default settings if not exists
            conn.execute('''
                INSERT OR IGNORE INTO user_settings (id, daily_new_limit, daily_reviews_limit)
                VALUES (1, 20, 200)
            ''')
            conn.commit()

    def sync_flashcards(self, job_id: str, flashcards: List[dict]):
        """
        Sync newly generated flashcards to the SRS database.
        flashcards: list of dicts with 'id', 'priority' (optional)
        """
        now = datetime.now(timezone.utc)
        with self._get_conn() as conn:
            for fc in flashcards:
                fc_id = fc.get('id') or str(uuid.uuid4())
                priority = fc.get('priority', 0.5)
                
                # Check if it already exists
                cursor = conn.execute("SELECT id FROM flashcard_reviews WHERE flashcard_id = ?", (fc_id,))
                if cursor.fetchone():
                    continue

                card = Card() # New default FSRS card
                
                conn.execute('''
                    INSERT INTO flashcard_reviews 
                    (id, flashcard_id, job_id, state, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, priority)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()), fc_id, job_id,
                    card.state.value, now,
                    card.stability, card.difficulty,
                    card.elapsed_days, card.scheduled_days,
                    card.reps, card.lapses, priority
                ))
            conn.commit()

    def get_daily_queue(self) -> dict:
        """
        Retrieve the daily study queue following Review First Principle.
        Due Reviews > Learning > New (sorted by Priority).
        """
        with self._get_conn() as conn:
            # 1. Get limits
            row = conn.execute("SELECT daily_new_limit, daily_reviews_limit FROM user_settings WHERE id = 1").fetchone()
            daily_new_limit = row['daily_new_limit']
            daily_reviews_limit = row['daily_reviews_limit']
            
            now = datetime.now(timezone.utc)
            
            # Fetch Due Reviews (State = Review/Relearning, due <= now)
            cursor = conn.execute(
                "SELECT * FROM flashcard_reviews WHERE state IN (?, ?) AND due <= ? ORDER BY due ASC LIMIT ?",
                (State.Review.value, State.Relearning.value, now, daily_reviews_limit)
            )
            review_cards = [FlashcardReviewState(**dict(r)) for r in cursor.fetchall()]
            
            # Fetch Learning Cards (State = Learning)
            # Active learning cards shouldn't usually be hard limited
            cursor = conn.execute(
                "SELECT * FROM flashcard_reviews WHERE state = ? AND due <= ? ORDER BY due ASC LIMIT 50",
                (State.Learning.value, now)
            )
            learning_cards = [FlashcardReviewState(**dict(r)) for r in cursor.fetchall()]
            
            # Fetch New Cards (State = New) ordered by priority
            cursor = conn.execute(
                "SELECT * FROM flashcard_reviews WHERE state = ? ORDER BY priority DESC LIMIT ?",
                (State.New.value, daily_new_limit)
            )
            new_cards = [FlashcardReviewState(**dict(r)) for r in cursor.fetchall()]
            
            # Helper to join flashcard content
            def enrich(cards: List[FlashcardReviewState]):
                for c in cards:
                    try:
                        # Load flashcards for the job
                        fc_data = self.job_store.get_flashcards(uuid.UUID(c.job_id))
                        # Find the matching card
                        for fc in fc_data:
                            if fc.id == c.flashcard_id:
                                c.content = fc.dict()
                                break
                    except Exception as e:
                        logger.error(f"Failed to load flashcard content for {c.flashcard_id}: {e}")
            
            enrich(review_cards)
            enrich(learning_cards)
            enrich(new_cards)
            
            return {
                "new_cards": new_cards,
                "learning_cards": learning_cards,
                "review_cards": review_cards,
                "total_due": len(review_cards) + len(learning_cards) + len(new_cards)
            }

    def submit_review(self, review_id: str, rating_val: int) -> datetime:
        """
        Submit an FSRS review rating and update the card's state.
        Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
        """
        now = datetime.now(timezone.utc)
        
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM flashcard_reviews WHERE id = ?", (review_id,)).fetchone()
            if not row:
                raise ValueError("Review card not found")
                
            # Construct FSRS Card from db
            card = Card()
            card.state = State(row['state'])
            card.due = datetime.fromisoformat(row['due']) if isinstance(row['due'], str) else row['due']
            card.stability = row['stability']
            card.difficulty = row['difficulty']
            card.elapsed_days = row['elapsed_days']
            card.scheduled_days = row['scheduled_days']
            card.reps = row['reps']
            card.lapses = row['lapses']
            
            # Compatibility with fsrs>=0.3.0
            if hasattr(card, "last_review"):
                card.last_review = card.due
            
            # Rate the card
            rating = Rating(rating_val)
            scheduling_cards = self.fsrs.repeat(card, now)
            new_card = scheduling_cards[rating].card
            
            # Update DB
            conn.execute('''
                UPDATE flashcard_reviews
                SET state = ?, due = ?, stability = ?, difficulty = ?, 
                    elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?
                WHERE id = ?
            ''', (
                new_card.state.value, new_card.due,
                new_card.stability, new_card.difficulty,
                new_card.elapsed_days, new_card.scheduled_days,
                new_card.reps, new_card.lapses, review_id
            ))
            conn.commit()
            
            return new_card.due
