package com.faceattend_edu.identity_service.application.port.out;

import java.time.Duration;

/**
 * Counts failed logins per identifier and holds the temporary lock.
 *
 * <p>Nothing here touches the relational model: the counters are short-lived
 * state (in memory, or in Redis when {@code faceattend.recovery.store=redis} so
 * the lock survives restarts and is shared between replicas).</p>
 */
public interface LoginAttemptPort {

    /** Time left on the lock, or {@link Duration#ZERO} when the identifier is not locked. */
    Duration lockRemaining(String identifier);

    /**
     * Registers a failed login. When the count reaches {@code maxAttempts} the
     * identifier is locked for {@code lockDuration}.
     *
     * @return {@code true} if this failure is the one that triggered the lock
     */
    boolean recordFailure(String identifier, int maxAttempts, Duration lockDuration);

    /** Clears the counter after a successful login. */
    void reset(String identifier);
}
