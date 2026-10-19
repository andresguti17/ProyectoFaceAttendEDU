package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PasswordPolicyJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordPolicyJpaRepository extends JpaRepository<PasswordPolicyJpaEntity, Integer> {
}
