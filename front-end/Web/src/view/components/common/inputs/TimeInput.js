// ============================================================
//  TimeInput — Input de hora con formateo automático
// ============================================================
//  - Solo acepta números (y A/P para AM/PM en formato 12 h)
//  - Sigue el formato de hora de Configuración (24 h o 12 h AM/PM)
//  - Pone los dos puntos y ajusta horas/minutos mientras se escribe
//  - Recibe y entrega la hora en 24 h "HH:MM" (como la guarda el backend);
//    mientras está incompleta entrega "" para que el formulario la pida completa
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import TextInput from "./TextInput";
import { useDateFormat } from "../../hooks/useDateFormat";
import { useTranslation } from "../../../../core/utils/i18n/hooks/useTranslation";
import { formatClockTime } from "../../../../core/constants/dateFormats";

const pad = (n) => String(n).padStart(2, "0");

/** Texto que ve el usuario → { display, internal } según el formato; `prevMeridiem` conserva AM/PM. */
export function maskTime(raw, is24h, prevMeridiem = "AM") {
    const text = String(raw ?? "");
    let digits = text.replace(/\D/g, "").slice(0, 4);
    if (!digits) return { display: "", internal: "", meridiem: prevMeridiem };

    let meridiem = prevMeridiem;
    if (/p/i.test(text)) meridiem = "PM";
    else if (/a/i.test(text)) meridiem = "AM";

    // Una primera cifra que no puede ser decena de hora se completa con 0 ("3" → "03:").
    const maxFirst = is24h ? 2 : 1;
    if (Number(digits[0]) > maxFirst) digits = `0${digits}`.slice(0, 4);

    let hours = digits.slice(0, 2);
    let minutes = digits.slice(2, 4);

    if (hours.length === 2) {
        let h = Number(hours);
        if (is24h) {
            if (h > 23) h = 23;
        } else if (h > 12) {
            // Escribir 13–23 en 12 h se convierte a la tarde (13 → 01 PM).
            if (h <= 23) {
                h -= 12;
                meridiem = "PM";
            } else {
                h = 12;
            }
        } else if (h === 0) {
            h = 12;
        }
        hours = pad(h);
    }
    if (minutes.length === 2 && Number(minutes) > 59) minutes = "59";
    if (minutes.length === 1 && Number(minutes) > 5) minutes = `0${minutes}`;

    const complete = hours.length === 2 && minutes.length === 2;
    let display = minutes ? `${hours}:${minutes}` : hours;
    if (!is24h && complete) display = `${display} ${meridiem}`;

    let internal = "";
    if (complete) {
        let h = Number(hours);
        if (!is24h) {
            if (meridiem === "AM") h = h === 12 ? 0 : h;
            else h = h === 12 ? 12 : h + 12;
        }
        internal = `${pad(h)}:${minutes}`;
    }
    return { display, internal, meridiem };
}

export function TimeInput({
    value, // "HH:MM" en 24 h
    onChangeText, // recibe "HH:MM" en 24 h o "" mientras está incompleta
    label,
    placeholder,
    required = false,
    error = false,
    errorMessage,
    ...props
}) {
    const { timeFormat24h } = useDateFormat();
    const { t } = useTranslation();
    const [display, setDisplay] = useState(() => (value ? formatClockTime(value, timeFormat24h) : ""));
    const [focused, setFocused] = useState(false);
    const meridiemRef = useRef("AM");
    const userInputRef = useRef(false);

    // El valor externo (abrir en modo edición, cambiar el formato en Configuración) se muestra
    // en el formato vigente; lo que el propio usuario teclea no se reescribe.
    useEffect(() => {
        if (!userInputRef.current) {
            setDisplay(value ? formatClockTime(value, timeFormat24h) : "");
        }
        userInputRef.current = false;
    }, [value, timeFormat24h]);

    const handleChange = useCallback(
        (text) => {
            const prevDigits = display.replace(/\D/g, "");
            let source = text;
            // Borrar sobre ":" o "AM/PM" no cambia los dígitos: se interpreta como quitar el último.
            if (text.length < display.length && text.replace(/\D/g, "") === prevDigits) {
                source = prevDigits.slice(0, -1);
            }
            const { display: next, internal, meridiem } = maskTime(source, timeFormat24h, meridiemRef.current);
            meridiemRef.current = meridiem;
            setDisplay(next);
            userInputRef.current = internal !== (value || "");
            onChangeText(internal);
        },
        [display, timeFormat24h, onChangeText, value]
    );

    const incomplete = !focused && display !== "" && !value;
    const maxChars = timeFormat24h ? 5 : 8;

    return (
        <TextInput
            {...props}
            label={label}
            value={display}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder || (timeFormat24h ? "HH:MM" : "HH:MM AM")}
            required={required}
            error={error || incomplete}
            errorMessage={error ? errorMessage : incomplete ? t("Hora incompleta") : undefined}
            type="text"
            maxLength={maxChars}
        />
    );
}

export default TimeInput;
