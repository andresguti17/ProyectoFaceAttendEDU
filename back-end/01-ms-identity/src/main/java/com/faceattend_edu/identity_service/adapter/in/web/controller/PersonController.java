package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PageResponse;
import com.faceattend_edu.identity_service.adapter.in.web.dto.PersonDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.security.AuthTokenFilter;
import com.faceattend_edu.identity_service.application.port.in.ChangePersonStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetPersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListPersonsUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdatePersonUseCase;
import com.faceattend_edu.identity_service.domain.model.Person;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/persons")
@RequiredArgsConstructor
public class PersonController {

    private final CreatePersonUseCase createPersonUseCase;
    private final GetPersonUseCase getPersonUseCase;
    private final ListPersonsUseCase listPersonsUseCase;
    private final UpdatePersonUseCase updatePersonUseCase;
    private final ChangePersonStatusUseCase changePersonStatusUseCase;
    private final PersonWebMapper personWebMapper;

    @PostMapping
    public ResponseEntity<PersonDto> createPerson(@Valid @RequestBody PersonDto personDto,
                                                  HttpServletRequest request) {
        Person toCreate = personWebMapper.toDomain(personDto);
        if (request.getAttribute("X-User-Id") != null) {
            try {
                toCreate.setCreatedBy(UUID.fromString(String.valueOf(request.getAttribute("X-User-Id"))));
            } catch (IllegalArgumentException ignored) {
                // identificador de sesión ajeno al formato UUID: se deja sin autor
            }
        }
        Person created = createPersonUseCase.createPerson(toCreate);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.getPersonId()).toUri();
        return ResponseEntity.created(location).body(personWebMapper.toDto(created));
    }

    @GetMapping
    public ResponseEntity<PageResponse<PersonDto>> listPersons(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer limit,
            HttpServletRequest request) {
        int safePage = PageResponse.safePage(page);
        int safeLimit = PageResponse.safeLimit(limit);
        if (request.getAttribute(AuthTokenFilter.PERSON_SCOPE_ATTRIBUTE) instanceof Set<?> scope) {
            // Quien no es administrador solo lista su alcance (propia, sus aprendices o sus
            // instructores): una página en SQL, ordenada por apellido.
            Set<UUID> personIds = scope.stream().map(id -> (UUID) id).collect(Collectors.toSet());
            List<PersonDto> pageItems = listPersonsUseCase.listPersons(safePage - 1, safeLimit, personIds).stream()
                    .map(personWebMapper::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(PageResponse.ofSlice(pageItems, safePage, safeLimit,
                    listPersonsUseCase.countPersons(personIds)));
        }
        List<PersonDto> slice = listPersonsUseCase.listPersons(safePage - 1, safeLimit).stream()
                .map(personWebMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(
                PageResponse.ofSlice(slice, safePage, safeLimit, listPersonsUseCase.countPersons()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PersonDto> getPerson(@PathVariable UUID id) {
        return ResponseEntity.ok(personWebMapper.toDto(getPersonUseCase.getPerson(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PersonDto> updatePerson(@PathVariable UUID id, @Valid @RequestBody PersonDto personDto,
                                                  HttpServletRequest request) {
        personDto.setPersonId(id);
        if (Boolean.TRUE.equals(request.getAttribute(AuthTokenFilter.SELF_EDIT_ATTRIBUTE))) {
            // Autoedición: estado y documento de identidad solo los cambia administración.
            PersonDto current = personWebMapper.toDto(getPersonUseCase.getPerson(id));
            personDto.setStatus(current.getStatus());
            personDto.setDocumentNumber(current.getDocumentNumber());
            personDto.setDocumentType(current.getDocumentType());
            if (Boolean.TRUE.equals(request.getAttribute(AuthTokenFilter.SELF_EDIT_LIMITED_ATTRIBUTE))) {
                // Sin identity.person:write: nombres y correo (identificador de login) también fijos;
                // el correo se cambia por PUT /auth/me/profile con la contraseña actual.
                personDto.setName(current.getName());
                personDto.setLastName(current.getLastName());
                personDto.setEmail(current.getEmail());
            }
        }
        updatePersonUseCase.updatePerson(id, personWebMapper.toDomain(personDto));
        return ResponseEntity.ok(personWebMapper.toDto(getPersonUseCase.getPerson(id)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable UUID id, @RequestParam boolean status) {
        changePersonStatusUseCase.changeStatus(id, status);
        return ResponseEntity.noContent().build();
    }
}
