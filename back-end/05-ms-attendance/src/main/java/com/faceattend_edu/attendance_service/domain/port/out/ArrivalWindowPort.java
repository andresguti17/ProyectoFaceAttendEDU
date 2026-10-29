package com.faceattend_edu.attendance_service.domain.port.out;

import com.faceattend_edu.attendance_service.domain.model.ArrivalWindow;

public interface ArrivalWindowPort {
    /**
     * @throws com.faceattend_edu.attendance_service.domain.exception.ValidationException if the class
     *         session does not exist or the caller cannot see it
     * @throws com.faceattend_edu.attendance_service.domain.exception.PeerUnavailableException if
     *         scheduling or configuration cannot answer
     */
    ArrivalWindow windowFor(Long classSessionId);
}
