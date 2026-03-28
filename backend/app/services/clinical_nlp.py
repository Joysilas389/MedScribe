"""
ClinicalNLPService — Medical entity extraction and clinical concept identification.

Handles:
- Parsing transcripts to identify medical entities
- Extracting symptoms, medications, procedures, clinical concepts
- Relevance filtering — removing non-clinical conversation
- Mapping extracted data to note sections
- Handling clinical terminology normalization
"""

import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class ClinicalNLPService:
    """Extracts clinical concepts from raw transcript text."""

    # Medical entity patterns (simplified — production would use spaCy/medCAT)
    MEDICATION_PATTERNS = [
        r'\b(?:prescribed?|taking|started?|on|dose|mg|mcg|units?)\b',
        r'\b\d+\s*(?:mg|mcg|ml|units?|tablets?|caps?|pills?)\b',
    ]

    SYMPTOM_KEYWORDS = [
        "pain", "ache", "fever", "cough", "nausea", "vomiting", "diarrhea",
        "fatigue", "weakness", "dizziness", "headache", "shortness of breath",
        "chest pain", "swelling", "rash", "itching", "numbness", "tingling",
        "bleeding", "bruising", "weight loss", "weight gain", "insomnia",
        "anxiety", "depression", "palpitations", "dyspnea", "edema",
    ]

    PROCEDURE_KEYWORDS = [
        "surgery", "biopsy", "scan", "x-ray", "mri", "ct scan", "ultrasound",
        "ecg", "ekg", "echocardiogram", "colonoscopy", "endoscopy",
        "blood test", "lab work", "culture", "catheter", "intubation",
    ]

    ALLERGY_PATTERNS = [
        r'\b(?:allergic|allergy|allergies|react(?:ion|s)?)\s+(?:to\s+)?(\w+)',
    ]

    # Non-clinical conversation markers (to be filtered out)
    NON_CLINICAL_MARKERS = [
        r'\b(?:weather|traffic|parking|weekend|holiday|vacation)\b',
        r'\b(?:how are you|nice to see you|have a good|take care)\b',
        r'\b(?:insurance|copay|billing|appointment|schedule|receptionist)\b',
        r'\b(?:sorry I\'m late|running late|wait(?:ing|ed))\b',
    ]

    def extract_clinical_entities(self, transcript_text: str) -> Dict[str, Any]:
        """
        Extract all clinical entities from transcript text.

        Returns a structured dict organized by note section.
        """
        # Split into sentences for granular processing
        sentences = self._split_into_sentences(transcript_text)

        # Filter out non-clinical content
        clinical_sentences = self._filter_clinical_content(sentences)

        entities = {
            "chief_complaint": self._extract_chief_complaint(clinical_sentences),
            "symptoms": self._extract_symptoms(clinical_sentences),
            "medications": self._extract_medications(clinical_sentences),
            "allergies": self._extract_allergies(clinical_sentences),
            "procedures": self._extract_procedures(clinical_sentences),
            "vitals": self._extract_vitals(clinical_sentences),
            "diagnoses": self._extract_diagnoses(clinical_sentences),
            "family_history_mentions": self._extract_family_history(clinical_sentences),
            "social_history_mentions": self._extract_social_history(clinical_sentences),
            "exam_findings": self._extract_exam_findings(clinical_sentences),
            "plan_items": self._extract_plan_items(clinical_sentences),
            "follow_up": self._extract_follow_up(clinical_sentences),
            "raw_clinical_text": "\n".join(clinical_sentences),
            "filtered_count": len(sentences) - len(clinical_sentences),
            "clinical_count": len(clinical_sentences),
        }

        return entities

    def map_to_note_sections(
        self,
        entities: Dict[str, Any],
        template: str = "general_practice"
    ) -> Dict[str, str]:
        """
        Map extracted entities to clinical note sections.
        Returns a dict keyed by section name with content strings.
        """
        sections = {
            "chief_complaint": entities.get("chief_complaint", ""),
            "hpi": self._build_hpi(entities),
            "past_medical_history": "",  # Built from context
            "medications": "\n".join(entities.get("medications", [])),
            "allergies": "\n".join(entities.get("allergies", [])),
            "family_history": "\n".join(entities.get("family_history_mentions", [])),
            "social_history": "\n".join(entities.get("social_history_mentions", [])),
            "review_of_systems": self._build_ros(entities),
            "physical_examination": self._build_exam(entities),
            "assessment": "\n".join(entities.get("diagnoses", [])),
            "plan": "\n".join(entities.get("plan_items", [])),
            "follow_up": "\n".join(entities.get("follow_up", [])),
        }

        # Identify missing sections
        missing = [k for k, v in sections.items() if not v.strip()]

        return {
            "sections": sections,
            "missing_sections": missing,
        }

    def _filter_clinical_content(self, sentences: List[str]) -> List[str]:
        """Remove non-clinical conversation from sentences."""
        clinical = []
        for sentence in sentences:
            is_non_clinical = False
            lower = sentence.lower()
            for pattern in self.NON_CLINICAL_MARKERS:
                if re.search(pattern, lower):
                    is_non_clinical = True
                    break
            if not is_non_clinical and len(sentence.strip()) > 5:
                clinical.append(sentence)
        return clinical

    def _extract_chief_complaint(self, sentences: List[str]) -> str:
        """Extract the primary reason for visit."""
        cc_patterns = [
            r'(?:here|came|coming|visit)\s+(?:for|about|because|regarding)',
            r'(?:complain(?:ing|t|s)?|concern(?:ed|s)?|problem|issue|bother)',
            r'(?:what brings you|reason for)',
        ]
        for sentence in sentences[:10]:  # CC usually early in conversation
            for pattern in cc_patterns:
                if re.search(pattern, sentence.lower()):
                    return sentence.strip()
        return ""

    def _extract_symptoms(self, sentences: List[str]) -> List[str]:
        """Extract mentioned symptoms."""
        found = []
        for sentence in sentences:
            lower = sentence.lower()
            for symptom in self.SYMPTOM_KEYWORDS:
                if symptom in lower and sentence not in found:
                    found.append(sentence.strip())
                    break
        return found

    def _extract_medications(self, sentences: List[str]) -> List[str]:
        """Extract medication mentions."""
        found = []
        for sentence in sentences:
            for pattern in self.MEDICATION_PATTERNS:
                if re.search(pattern, sentence.lower()):
                    found.append(sentence.strip())
                    break
        return found

    def _extract_allergies(self, sentences: List[str]) -> List[str]:
        """Extract allergy mentions."""
        found = []
        for sentence in sentences:
            for pattern in self.ALLERGY_PATTERNS:
                if re.search(pattern, sentence.lower()):
                    found.append(sentence.strip())
                    break
        return found

    def _extract_procedures(self, sentences: List[str]) -> List[str]:
        """Extract procedure/investigation mentions."""
        found = []
        for sentence in sentences:
            lower = sentence.lower()
            for kw in self.PROCEDURE_KEYWORDS:
                if kw in lower:
                    found.append(sentence.strip())
                    break
        return found

    def _extract_vitals(self, sentences: List[str]) -> List[str]:
        """Extract vital signs mentions."""
        vitals_pattern = r'\b(?:blood pressure|bp|heart rate|hr|pulse|temperature|temp|respiratory rate|rr|oxygen|spo2|o2 sat)\b'
        return [s.strip() for s in sentences if re.search(vitals_pattern, s.lower())]

    def _extract_diagnoses(self, sentences: List[str]) -> List[str]:
        """Extract diagnostic assessments."""
        dx_patterns = [
            r'(?:diagnos(?:is|e|ed)|assessment|impression|suspect|consistent with|likely)',
            r'(?:differential|rule out|r/o|working diagnosis)',
        ]
        found = []
        for sentence in sentences:
            for pattern in dx_patterns:
                if re.search(pattern, sentence.lower()):
                    found.append(sentence.strip())
                    break
        return found

    def _extract_family_history(self, sentences: List[str]) -> List[str]:
        """Extract family history mentions."""
        fhx_pattern = r'\b(?:father|mother|parent|brother|sister|sibling|family|hereditary|genetic|grandmother|grandfather)\b'
        return [s.strip() for s in sentences if re.search(fhx_pattern, s.lower())]

    def _extract_social_history(self, sentences: List[str]) -> List[str]:
        """Extract social history mentions."""
        shx_pattern = r'\b(?:smok(?:e|ing|er)|alcohol|drink|drug|occupation|work|live|married|exercise|diet|tobacco|vap(?:e|ing))\b'
        return [s.strip() for s in sentences if re.search(shx_pattern, s.lower())]

    def _extract_exam_findings(self, sentences: List[str]) -> List[str]:
        """Extract physical examination findings."""
        exam_pattern = r'\b(?:exam(?:ination)?|palpat|auscultat|inspect|percuss|normal|abnormal|tender|swollen|clear|murmur)\b'
        return [s.strip() for s in sentences if re.search(exam_pattern, s.lower())]

    def _extract_plan_items(self, sentences: List[str]) -> List[str]:
        """Extract treatment plan items."""
        plan_pattern = r'\b(?:prescri(?:be|ption)|order|refer|start|increase|decrease|discontinue|follow.?up|return|recommend)\b'
        return [s.strip() for s in sentences if re.search(plan_pattern, s.lower())]

    def _extract_follow_up(self, sentences: List[str]) -> List[str]:
        """Extract follow-up instructions."""
        fu_pattern = r'\b(?:follow.?up|return|come back|weeks?|months?|call if|warning signs?|emergency|er |urgent)\b'
        return [s.strip() for s in sentences if re.search(fu_pattern, s.lower())]

    @staticmethod
    def _split_into_sentences(text: str) -> List[str]:
        """Split text into sentences."""
        # Handle speaker labels like [Physician]: or [Patient]:
        text = re.sub(r'\[(?:Physician|Patient|Unknown)\]:\s*', '', text)
        sentences = re.split(r'(?<=[.!?])\s+|\n+', text)
        return [s.strip() for s in sentences if s.strip()]

    def _build_hpi(self, entities: Dict[str, Any]) -> str:
        """Build HPI narrative from symptoms and context."""
        symptoms = entities.get("symptoms", [])
        if not symptoms:
            return ""
        return " ".join(symptoms)

    def _build_ros(self, entities: Dict[str, Any]) -> str:
        """Build Review of Systems from extracted data."""
        symptoms = entities.get("symptoms", [])
        if not symptoms:
            return ""
        return "\n".join(f"- {s}" for s in symptoms)

    def _build_exam(self, entities: Dict[str, Any]) -> str:
        """Build physical examination section."""
        findings = entities.get("exam_findings", [])
        if not findings:
            return ""
        return "\n".join(f"- {f}" for f in findings)


clinical_nlp = ClinicalNLPService()
