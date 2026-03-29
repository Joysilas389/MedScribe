"""
NotePolisher — Claude API integration for note polishing and structuring.

Handles:
- Sending structured section data to Claude API for professional polishing
- Clinical-grade language transformation
- Preserving clinical uncertainty (never fabricating certainty)
- Removing filler words, false starts, conversational artifacts
- Normalizing grammar and medical terminology
- Supporting multilingual output
- Never hallucinating — only documenting what was spoken

AI Processing Rules (strictly enforced):
1. Remove filler words, false starts, conversational artifacts
2. Ignore non-clinical conversation
3. Normalize grammar and medical terminology
4. Preserve clinical uncertainty
5. Never hallucinate
6. Highlight missing information
"""

import logging
import json
from typing import Dict, Any, Optional
from app.core import config

logger = logging.getLogger(__name__)


class NotePolishError(Exception):
    pass


class NotePolisher:
    """Claude API integration for transforming raw clinical data into polished notes."""

    SYSTEM_PROMPT = """You are MedScribe's clinical documentation engine. Your role is to transform raw clinical conversation extracts into polished, professional medical documentation.

STRICT RULES — VIOLATIONS ARE UNACCEPTABLE:

1. NEVER HALLUCINATE: Do not add any clinical detail, finding, diagnosis, medication, or fact that was not explicitly stated in the provided transcript content. If you are uncertain, mark it with [UNCERTAIN].

2. PRESERVE UNCERTAINTY: If the physician expressed uncertainty (e.g., "might be," "could be," "I'm not sure"), preserve that uncertainty in your output. Never convert uncertain statements into definitive assertions.

3. REMOVE NON-CLINICAL CONTENT: Remove all greetings, small talk, weather discussions, scheduling logistics, insurance questions, and filler words (um, uh, you know, like, I mean).

4. PROFESSIONAL LANGUAGE: Normalize grammar, spelling, and medical terminology to professional documentation standards. Use standard medical abbreviations where appropriate.

5. MISSING SECTIONS: If a section has no relevant content from the transcript, output exactly: "[NOT DISCUSSED]" — do not invent content.

6. NO DIAGNOSTIC OVERREACH: Document what was discussed. Do not add diagnoses, suggest treatments, or interpret findings beyond what the physician explicitly stated.

7. OUTPUT FORMAT: Return a valid JSON object with exactly these keys:
   - chief_complaint
   - hpi (History of Present Illness — chronological narrative)
   - past_medical_history
   - medications (with dosages where mentioned)
   - allergies (with reaction types where mentioned)
   - family_history
   - social_history
   - nutritional_history (diet, appetite, feeding, BMI, supplements)
   - immunization_history (vaccines, boosters, immunization records)
   - developmental_history (milestones, growth — for pediatric encounters)
   - gynecological_history (menstrual, contraception, screening — for OB/GYN)
   - obstetric_history (pregnancies, deliveries, complications — for OB/GYN)
   - review_of_systems (organized by organ system as a JSON object)
   - physical_examination (organized by system as a JSON object)
   - assessment
   - plan
   - follow_up
   - uncertain_fields (list of field names where information was inferred or uncertain)
   - missing_sections (list of section names where no info was available)

Return ONLY the JSON object. No preamble, no explanation, no markdown."""

    def __init__(self):
        self._client = None

    async def _get_client(self):
        """Lazy-initialize the Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(
                    api_key=config.anthropic_api_key
                )
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic client: {type(e).__name__}")
                raise NotePolishError("AI service unavailable.")
        return self._client

    async def polish_note(
        self,
        raw_sections: Dict[str, str],
        transcript_text: str,
        template: str = "general_practice",
        output_language: str = "en",
        patient_context: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Polish raw clinical data into a structured, professional note.

        Args:
            raw_sections: Dict of section name -> raw extracted content
            transcript_text: Full transcript text for context
            template: Specialty template name
            output_language: Target language for the note
            patient_context: Optional patient demographics (no PHI in API calls)

        Returns:
            Dict with polished note sections and metadata
        """
        if not config.anthropic_api_key:
            return self._dev_fallback(raw_sections)

        try:
            client = await self._get_client()

            user_prompt = self._build_prompt(
                raw_sections, transcript_text, template, output_language
            )

            response = await client.messages.create(
                model=config.claude_model,
                max_tokens=config.claude_max_tokens,
                system=self.SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}]
            )

            # Extract text content
            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text

            # Parse JSON response
            polished = self._parse_response(content)
            return polished

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON")
            raise NotePolishError("AI returned an invalid response. Please try again.")
        except Exception as e:
            logger.error(f"Note polishing error: {type(e).__name__}")
            raise NotePolishError("AI processing failed. Please try again.")

    async def translate_note(
        self,
        note_sections: Dict[str, Any],
        target_language: str
    ) -> Dict[str, Any]:
        """Translate a polished note to a different language."""
        if not config.anthropic_api_key:
            return note_sections

        language_names = {
            "en": "English", "es": "Spanish", "fr": "French",
            "pt": "Portuguese", "ar": "Arabic", "zh": "Mandarin Chinese",
            "hi": "Hindi", "sw": "Swahili"
        }
        lang_name = language_names.get(target_language, "English")

        try:
            client = await self._get_client()
            response = await client.messages.create(
                model=config.claude_model,
                max_tokens=config.claude_max_tokens,
                system=(
                    f"Translate the following clinical note sections to {lang_name}. "
                    "Preserve all medical terminology accurately. "
                    "Maintain the JSON structure exactly. "
                    "Return ONLY the translated JSON object."
                ),
                messages=[{
                    "role": "user",
                    "content": json.dumps(note_sections, ensure_ascii=False)
                }]
            )

            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text

            return self._parse_response(content)

        except Exception as e:
            logger.error(f"Translation error: {type(e).__name__}")
            return note_sections  # Return original on failure

    async def generate_patient_instructions(
        self,
        plan: str,
        follow_up: str,
        target_language: str = "en"
    ) -> str:
        """Generate patient-friendly discharge instructions."""
        if not config.anthropic_api_key:
            return f"Plan: {plan}\nFollow-up: {follow_up}"

        language_names = {
            "en": "English", "es": "Spanish", "fr": "French",
            "pt": "Portuguese", "ar": "Arabic", "zh": "Mandarin Chinese",
            "hi": "Hindi", "sw": "Swahili"
        }
        lang_name = language_names.get(target_language, "English")

        try:
            client = await self._get_client()
            response = await client.messages.create(
                model=config.claude_model,
                max_tokens=1024,
                system=(
                    f"Generate clear, patient-friendly discharge instructions in {lang_name}. "
                    "Use simple language a non-medical person can understand. "
                    "Include warning signs to watch for. "
                    "Be concise and organized with bullet points."
                ),
                messages=[{
                    "role": "user",
                    "content": f"Treatment Plan:\n{plan}\n\nFollow-up:\n{follow_up}"
                }]
            )

            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            return content

        except Exception as e:
            logger.error(f"Patient instructions error: {type(e).__name__}")
            return f"Plan: {plan}\nFollow-up: {follow_up}"

    def _build_prompt(
        self,
        raw_sections: Dict[str, str],
        transcript_text: str,
        template: str,
        output_language: str
    ) -> str:
        """Build the prompt for Claude with all context."""
        language_names = {
            "en": "English", "es": "Spanish", "fr": "French",
            "pt": "Portuguese", "ar": "Arabic", "zh": "Mandarin Chinese",
            "hi": "Hindi", "sw": "Swahili"
        }
        lang_name = language_names.get(output_language, "English")

        prompt = f"""Specialty Template: {template}
Output Language: {lang_name}

=== FULL TRANSCRIPT ===
{transcript_text}

=== EXTRACTED CLINICAL DATA (pre-processed) ===
{json.dumps(raw_sections, indent=2, ensure_ascii=False)}

Transform the above into a polished, professional clinical note following all rules in your system instructions. Output the result as a JSON object."""

        return prompt

    @staticmethod
    def _parse_response(content: str) -> Dict[str, Any]:
        """Parse Claude's JSON response, handling markdown fences."""
        content = content.strip()
        # Remove markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(content)

    @staticmethod
    def _dev_fallback(raw_sections: Dict[str, str]) -> Dict[str, Any]:
        """Development fallback when Claude API is not configured."""
        result = {
            "chief_complaint": raw_sections.get("chief_complaint", "[NOT DISCUSSED]"),
            "hpi": raw_sections.get("hpi", "[NOT DISCUSSED]"),
            "past_medical_history": raw_sections.get("past_medical_history", "[NOT DISCUSSED]"),
            "medications": raw_sections.get("medications", "[NOT DISCUSSED]"),
            "allergies": raw_sections.get("allergies", "[NOT DISCUSSED]"),
            "family_history": raw_sections.get("family_history", "[NOT DISCUSSED]"),
            "social_history": raw_sections.get("social_history", "[NOT DISCUSSED]"),
            "nutritional_history": raw_sections.get("nutritional_history", "[NOT DISCUSSED]"),
            "immunization_history": raw_sections.get("immunization_history", "[NOT DISCUSSED]"),
            "developmental_history": raw_sections.get("developmental_history", "[NOT DISCUSSED]"),
            "gynecological_history": raw_sections.get("gynecological_history", "[NOT DISCUSSED]"),
            "obstetric_history": raw_sections.get("obstetric_history", "[NOT DISCUSSED]"),
            "review_of_systems": {},
            "physical_examination": {},
            "assessment": raw_sections.get("assessment", "[NOT DISCUSSED]"),
            "plan": raw_sections.get("plan", "[NOT DISCUSSED]"),
            "follow_up": raw_sections.get("follow_up", "[NOT DISCUSSED]"),
            "uncertain_fields": [],
            "missing_sections": [
                k for k, v in raw_sections.items()
                if not v or v == "[NOT DISCUSSED]"
            ],
        }
        return result

    async def close(self):
        """Clean up client resources."""
        if self._client:
            await self._client.close()
            self._client = None


note_polisher = NotePolisher()
