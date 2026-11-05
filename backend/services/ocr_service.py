
import logging
import re
import threading

from pathlib import Path

import easyocr
import fitz
import numpy as np


logger = logging.getLogger(__name__)


# ==========================================
# CONFIGURATION
# ==========================================

MAX_PDF_PAGES = 50

SUPPORTED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png"
}

SUPPORTED_DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# ==========================================
# INITIALIZE EASYOCR ONCE
# ==========================================

reader = None
reader_lock = threading.Lock()


def get_ocr_reader():

    global reader

    with reader_lock:

        if reader is None:

            logger.info("Initializing EasyOCR reader")

            reader = easyocr.Reader(
                ["en"],
                gpu=False
            )

    return reader


# ==========================================
# SKILLS FOR RESUME EXTRACTION
# ==========================================

SKILLS_LIST = [
    "Python",
    "Java",
    "JavaScript",
    "React",
    "Node.js",
    "FastAPI",
    "Django",
    "Flask",
    "MongoDB",
    "MySQL",
    "PostgreSQL",
    "SQL",
    "HTML",
    "CSS",
    "Machine Learning",
    "Deep Learning",
    "Artificial Intelligence",
    "Data Analysis",
    "Pandas",
    "NumPy",
    "Power BI",
    "Excel",
    "AWS",
    "Docker",
    "Git",
    "GitHub",
    "C++",
    "C",
    "TypeScript",
    "Express.js",
    "TensorFlow",
    "PyTorch",
    "Scikit-learn",
    "Communication"
]


# ==========================================
# SENSITIVE INFORMATION MASKING
# ==========================================

AADHAAR_PATTERN = re.compile(
    r"(?<!\d)(?:\d[\s-]?){11}\d(?!\d)"
)

PAN_PATTERN = re.compile(
    r"\b[A-Z]{5}\d{4}[A-Z]\b",
    re.IGNORECASE
)

DRIVING_LICENSE_PATTERN = re.compile(
    r"\b[A-Z]{2}[- ]?\d{2}[- ]?\d{4,12}\b",
    re.IGNORECASE
)


def mask_sensitive_text(text):

    if not isinstance(text, str):
        return text

    # Mask Aadhaar numbers
    def mask_aadhaar(match):

        digits = re.sub(
            r"\D",
            "",
            match.group(0)
        )

        if len(digits) != 12:
            return match.group(0)

        return "XXXX XXXX " + digits[-4:]

    text = AADHAAR_PATTERN.sub(
        mask_aadhaar,
        text
    )

    # Mask PAN numbers
    def mask_pan(match):

        pan = match.group(0).upper()

        return "XXXXX" + pan[-5:]

    text = PAN_PATTERN.sub(
        mask_pan,
        text
    )

    # Mask Driving Licence numbers
    def mask_driving_license(match):

        number = re.sub(
            r"[^A-Z0-9]",
            "",
            match.group(0).upper()
        )

        return "XXXX" + number[-4:]

    text = DRIVING_LICENSE_PATTERN.sub(
        mask_driving_license,
        text
    )

    return text


def mask_sensitive_data(data):

    if isinstance(data, dict):

        return {
            key: mask_sensitive_data(value)
            for key, value in data.items()
        }

    if isinstance(data, list):

        return [
            mask_sensitive_data(item)
            for item in data
        ]

    if isinstance(data, tuple):

        return [
            mask_sensitive_data(item)
            for item in data
        ]

    if isinstance(data, str):

        return mask_sensitive_text(data)

    return data


# ==========================================
# IMAGE OCR
# ==========================================

def extract_text_from_image(image_path):

    image_path = Path(image_path)

    if not image_path.is_file():
        raise FileNotFoundError(
            "Image file not found"
        )

    ocr_reader = get_ocr_reader()

    results = ocr_reader.readtext(
        str(image_path),
        detail=0,
        paragraph=True
    )

    return "\n".join(results)


# ==========================================
# PDF OCR
# ==========================================

def extract_text_from_pdf(pdf_path):

    pdf_path = Path(pdf_path)

    if not pdf_path.is_file():
        raise FileNotFoundError(
            "PDF file not found"
        )

    ocr_reader = get_ocr_reader()

    extracted_pages = []

    try:

        pdf_document = fitz.open(str(pdf_path))

    except Exception as error:

        logger.exception("Unable to open PDF")

        raise ValueError(
            "Unable to open PDF document"
        ) from error

    try:

        if pdf_document.is_encrypted:

            raise ValueError(
                "Password-protected PDFs are not supported"
            )

        if len(pdf_document) == 0:

            raise ValueError(
                "PDF contains no pages"
            )

        if len(pdf_document) > MAX_PDF_PAGES:

            raise ValueError(
                f"PDF cannot contain more than {MAX_PDF_PAGES} pages"
            )

        for page in pdf_document:

            pix = page.get_pixmap(
                matrix=fitz.Matrix(2, 2),
                alpha=False
            )

            image = np.frombuffer(
                pix.samples,
                dtype=np.uint8
            ).reshape(
                pix.height,
                pix.width,
                pix.n
            )

            results = ocr_reader.readtext(
                image,
                detail=0,
                paragraph=True
            )

            extracted_pages.append(
                "\n".join(results)
            )

    except ValueError:
        raise

    except Exception as error:

        logger.exception("PDF OCR processing failed")

        raise ValueError(
            "Unable to process PDF document"
        ) from error

    finally:

        pdf_document.close()

    return "\n\n".join(extracted_pages)


# ==========================================
# COMMON HELPER FUNCTIONS
# ==========================================

def clean_lines(text):

    return [
        re.sub(r"\s+", " ", line).strip()
        for line in text.splitlines()
        if line.strip()
    ]


def extract_email(text):

    match = re.search(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text
    )

    return (
        match.group(0).lower()
        if match else None
    )


def extract_phone(text):

    match = re.search(
        r"(?<!\d)(?:\+91[-.\s]?)?[6-9]\d{9}(?!\d)",
        text
    )

    return match.group(0) if match else None


def extract_date(text):

    match = re.search(
        r"\b(?:"
        r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}"
        r"|"
        r"\d{4}[-/]\d{1,2}[-/]\d{1,2}"
        r")\b",
        text
    )

    return match.group(0) if match else None


def extract_name_from_first_lines(text):

    excluded = {
        "resume",
        "curriculum vitae",
        "cv",
        "profile",
        "contact",
        "personal details"
    }

    for line in clean_lines(text)[:6]:

        if (
            len(line) <= 60
            and line.lower() not in excluded
            and re.fullmatch(
                r"[A-Za-z][A-Za-z .'-]{1,59}",
                line
            )
            and "@" not in line
        ):

            return line

    return None


# ==========================================
# RESUME DATA EXTRACTION
# ==========================================

def extract_resume_data(text):

    lines = clean_lines(text)

    skills = []

    for skill in SKILLS_LIST:

        pattern = (
            r"(?<![A-Za-z0-9])"
            + re.escape(skill)
            + r"(?![A-Za-z0-9])"
        )

        if re.search(
            pattern,
            text,
            re.IGNORECASE
        ):

            skills.append(skill)

    education = []
    experience = []

    education_keywords = (
        "education",
        "qualification",
        "university",
        "college",
        "degree",
        "bachelor",
        "master"
    )

    experience_keywords = (
        "experience",
        "employment",
        "internship",
        "worked at",
        "work history"
    )

    for line in lines:

        lower = line.lower()

        if any(
            word in lower
            for word in education_keywords
        ):

            education.append(line)

        if any(
            word in lower
            for word in experience_keywords
        ):

            experience.append(line)

    return {
        "name": extract_name_from_first_lines(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": skills,
        "education": education,
        "experience": experience
    }


# ==========================================
# ID PROOF EXTRACTION
# ==========================================

def extract_id_proof_data(
    text,
    custom_document_name=None
):

    lower = text.lower()

    document_name = (
        custom_document_name or ""
    ).lower()

    is_aadhaar = (
        "aadhaar" in document_name
        or "aadhar" in document_name
        or "unique identification authority" in lower
        or (
            "government of india" in lower
            and "dob" in lower
        )
    )

    is_pan = (
        "pan" in document_name
        or "permanent account number" in lower
    )

    is_driving_licence = (
        "driving" in document_name
        or "licence" in document_name
        or "license" in document_name
        or "driving licence" in lower
        or "driving license" in lower
    )

    data = {
        "name": None,
        "date_of_birth": None,
        "gender": None,
        "address": None,
        "document_number": None,
        "document_name": custom_document_name
    }

    lines = clean_lines(text)

    # Aadhaar number - store masked only
    if is_aadhaar:

        match = AADHAAR_PATTERN.search(text)

        if match:

            digits = re.sub(
                r"\D",
                "",
                match.group(0)
            )

            if len(digits) == 12:

                data["document_number"] = (
                    "XXXX XXXX " + digits[-4:]
                )

    # PAN number - store masked only
    elif is_pan:

        match = PAN_PATTERN.search(text)

        if match:

            pan = match.group(0).upper()

            data["document_number"] = (
                "XXXXX" + pan[-5:]
            )

    # Driving licence - store masked only
    elif is_driving_licence:

        match = DRIVING_LICENSE_PATTERN.search(
            text.upper()
        )

        if match:

            number = re.sub(
                r"[^A-Z0-9]",
                "",
                match.group(0)
            )

            data["document_number"] = (
                "XXXX" + number[-4:]
            )

    # Name, DOB and gender
    for line in lines:

        lower_line = line.lower()

        if not data["name"] and (
            lower_line.startswith("name")
            or lower_line.startswith("नाम")
        ):

            parts = re.split(
                r"[:\-]",
                line,
                maxsplit=1
            )

            if len(parts) == 2 and parts[1].strip():

                data["name"] = parts[1].strip()

        if not data["date_of_birth"] and any(
            word in lower_line
            for word in [
                "dob",
                "date of birth",
                "birth"
            ]
        ):

            data["date_of_birth"] = extract_date(line)

        if not data["gender"]:

            if re.search(r"\bmale\b", lower_line):
                data["gender"] = "Male"

            elif re.search(r"\bfemale\b", lower_line):
                data["gender"] = "Female"

            elif "transgender" in lower_line:
                data["gender"] = "Transgender"

    # Address extraction only from labelled lines
    for index, line in enumerate(lines):

        if "address" in line.lower():

            parts = re.split(
                r"[:\-]",
                line,
                maxsplit=1
            )

            if len(parts) == 2 and parts[1].strip():

                data["address"] = parts[1].strip()

            elif index + 1 < len(lines):

                data["address"] = lines[index + 1]

            break

    data["email"] = extract_email(text)
    data["phone"] = extract_phone(text)

    return data


# ==========================================
# CERTIFICATE EXTRACTION
# ==========================================

def extract_certificate_data(
    text,
    custom_document_name=None
):

    lines = clean_lines(text)

    institute_keywords = [
        "university",
        "college",
        "institute",
        "school",
        "academy"
    ]

    course_keywords = [
        "certificate",
        "course",
        "training",
        "diploma",
        "completion",
        "achievement"
    ]

    institute = next(
        (
            line for line in lines
            if any(
                word in line.lower()
                for word in institute_keywords
            )
        ),
        None
    )

    course = next(
        (
            line for line in lines
            if any(
                word in line.lower()
                for word in course_keywords
            )
        ),
        None
    )

    return {
        "name": extract_name_from_first_lines(text),
        "course_or_certificate": course,
        "institute": institute,
        "issue_date": extract_date(text),
        "document_name": custom_document_name
    }


# ==========================================
# GENERIC DOCUMENT EXTRACTION
# ==========================================

def extract_generic_data(
    text,
    custom_document_name=None
):

    lines = clean_lines(text)

    sections = {
        "personal_details": [],
        "document_details": [],
        "dates": [],
        "contact_information": [],
        "address_information": [],
        "additional_information": []
    }

    personal_keywords = [
        "name",
        "father",
        "mother",
        "gender",
        "dob",
        "date of birth"
    ]

    document_keywords = [
        "number",
        "certificate",
        "registration",
        "identity",
        "document",
        "reference"
    ]

    address_keywords = [
        "address",
        "village",
        "district",
        "state",
        "pin code",
        "postal"
    ]

    for line in lines:

        lower = line.lower()

        if extract_date(line):

            sections["dates"].append(line)

        elif "@" in line or extract_phone(line):

            sections["contact_information"].append(line)

        elif any(
            word in lower
            for word in address_keywords
        ):

            sections["address_information"].append(line)

        elif any(
            word in lower
            for word in personal_keywords
        ):

            sections["personal_details"].append(line)

        elif any(
            word in lower
            for word in document_keywords
        ):

            sections["document_details"].append(line)

        else:

            sections["additional_information"].append(line)

    sections = {
        key: value
        for key, value in sections.items()
        if value
    }

    return {
        "document_name": custom_document_name,
        "sections": sections
    }


# ==========================================
# MAIN OCR PROCESSING FUNCTION
# ==========================================

def process_document(
    file_path,
    document_type="resume",
    custom_document_name=None
):

    file_path = Path(file_path)

    if not file_path.is_file():

        raise FileNotFoundError(
            "Document file not found"
        )

    if document_type not in SUPPORTED_DOCUMENT_TYPES:

        raise ValueError(
            "Unsupported document type"
        )

    extension = file_path.suffix.lower()

    # Extract raw text internally
    if extension == ".pdf":

        extracted_text = extract_text_from_pdf(
            file_path
        )

    elif extension in SUPPORTED_IMAGE_EXTENSIONS:

        extracted_text = extract_text_from_image(
            file_path
        )

    else:

        raise ValueError(
            "Unsupported document format"
        )

    if not extracted_text.strip():

        raise ValueError(
            "No text could be extracted from document"
        )

    # Select extraction logic
    if document_type == "resume":

        extracted_data = extract_resume_data(
            extracted_text
        )

    elif document_type == "id":

        extracted_data = extract_id_proof_data(
            extracted_text,
            custom_document_name
        )

    elif document_type == "certificate":

        extracted_data = extract_certificate_data(
            extracted_text,
            custom_document_name
        )

    else:

        extracted_data = extract_generic_data(
            extracted_text,
            custom_document_name
        )

    # Never return unmasked OCR text or extracted data
    safe_text = mask_sensitive_text(
        extracted_text
    )

    safe_data = mask_sensitive_data(
        extracted_data
    )

    return {
        "document_type": document_type,
        "custom_document_name": custom_document_name,
        "extracted_text": safe_text,
        "extracted_data": safe_data
    }
