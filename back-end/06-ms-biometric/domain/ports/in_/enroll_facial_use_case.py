from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID
@dataclass(frozen=True)
class EnrollFacialCommand:
    person_id: UUID
    encoding: list[float]
    model_version: str
class EnrollFacialUseCase(ABC):
    @abstractmethod
    def execute(self, cmd: EnrollFacialCommand) -> str: ...
