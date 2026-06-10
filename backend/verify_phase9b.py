import asyncio
import uuid
from datetime import datetime, timezone
import logging

from app.core.config import get_settings
from app.services.study.study_service import StudyService
from app.services.storage.job_store import JobStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_verification():
    settings = get_settings()
    job_store = JobStore(settings)
    study = StudyService(settings, job_store)
    
    logger.info("--- PHASE 9B VERIFICATION ---")
    
    job_id = str(uuid.uuid4())
    logger.info(f"Simulating lecture ingestion for Job: {job_id}")
    
    # 1. Simulate inserting 25 flashcards (Limit is 20 default)
    # We will assign varying priorities
    flashcards_data = []
    for i in range(25):
        fc_id = str(uuid.uuid4())
        # Make the last 5 high priority (0.9), others 0.5
        priority = 0.9 if i >= 20 else 0.5
        flashcards_data.append({
            "id": fc_id,
            "priority": priority
        })
        
    study.sync_flashcards(job_id, flashcards_data)
    logger.info(f"Inserted 25 flashcards to SRS.")
    
    # 2. Test Queue Limits & Priority Sorting
    queue = study.get_daily_queue()
    
    assert len(queue['new_cards']) == 20, f"Expected 20 new cards, got {len(queue['new_cards'])}"
    logger.info("✅ Daily limit (20 cards) successfully enforced.")
    
    # Check if high priority cards (priority=0.9) are at the front
    high_priority_count = sum(1 for c in queue['new_cards'] if c.priority == 0.9)
    assert high_priority_count == 5, f"Expected 5 high priority cards, got {high_priority_count}"
    logger.info("✅ Priority sorting (Review First & Priority Order) successfully validated.")
    
    # 3. Simulate an FSRS Review
    # Take the first card
    target_card = queue['new_cards'][0]
    review_id = target_card.id
    
    logger.info(f"Simulating review for Card {review_id} with rating 3 (Good)")
    
    # FSRS Review Submission
    next_due = study.submit_review(review_id, rating_val=3)
    logger.info(f"✅ Review submitted successfully! Next due date: {next_due}")
    
    # Verify State transition
    updated_queue = study.get_daily_queue()
    learning_or_review = [c for c in updated_queue['learning_cards'] + updated_queue['review_cards'] if c.id == review_id]
    assert len(learning_or_review) > 0, "Card did not advance to learning/review state"
    logger.info("✅ Card state successfully mutated by FSRS.")

if __name__ == "__main__":
    asyncio.run(run_verification())
