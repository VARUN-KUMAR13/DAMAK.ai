import asyncio
from app.core.config import get_settings
from app.services.storage.job_store import JobStore
from app.services.llm.ollama_service import OllamaService
from app.services.study.study_service import StudyService
from app.services.intelligence.flashcard_service import FlashcardService
from app.schemas.intelligence import FlashcardType
import uuid

async def test():
    settings = get_settings()
    job_store = JobStore(settings)
    ollama = OllamaService(settings)
    study = StudyService(settings, job_store)
    fc_service = FlashcardService(settings, job_store, ollama, study)
    
    job_store.load_chunks = lambda x: [{"spoken_text": "David Allen created the two-minute rule. If a task takes two minutes or less, do it immediately. Otherwise, delegate it or put it on your calendar."}]
    session_id = uuid.uuid4()
    
    for ctype in [FlashcardType.QA, FlashcardType.REVISION]:
        print(f"\nTesting {ctype.value}...")
        try:
            print(f"\n--- Testing {ctype.value} ---")
            
            # Using prompt generation from service
            prompt = fc_service._build_flashcard_prompt(
                context="David Allen created the two-minute rule. If a task takes two minutes or less, do it immediately. Otherwise, delegate it or put it on your calendar.",
                count=2,
                card_type=ctype
            )
            raw_response = await ollama.generate_response(prompt, json_format=True)
            print(f"\n[RAW OLLAMA OUTPUT]\n{raw_response}")
            
            structured_output = fc_service._parse_json_structure(raw_response)
            import json
            print(f"\n[PARSED BACKEND OBJECT]\n{json.dumps(structured_output, indent=2)}")
            
            res = await fc_service.generate_flashcards(session_id, 2, ctype)
            print(f"\n[FINAL API RESPONSE PAYLOAD]\n{res.json(indent=2)}")
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
