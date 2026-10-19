import { useState, useEffect, useRef, useCallback } from 'react';

export function useCountdown(initialSeconds = 0) {
    const [remaining, setRemaining] = useState(initialSeconds);
    const timerRef = useRef(null);
    const remainingRef = useRef(initialSeconds);

    useEffect(() => {
        remainingRef.current = remaining;
    }, [remaining]);

    useEffect(() => {
        if (initialSeconds <= 0) return;

        timerRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [initialSeconds]);

    const start = useCallback((seconds) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setRemaining(seconds);
        remainingRef.current = seconds;

        timerRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const reset = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setRemaining(0);
    }, []);

    return {
        remaining,
        isActive: remaining > 0,
        start,
        reset,
    };
}
