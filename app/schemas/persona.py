from pydantic import BaseModel

class PersonaConfigSave(BaseModel):
    category: str
    key: str
    content: str
