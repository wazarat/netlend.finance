"use client";
import type { ReactNode } from "react";
import { TokenDot } from "./TokenDot";

type Props = {
  id: string;
  label: string;
  token: string;
  value: string;
  onChange: (v: string) => void;
  balanceLabel?: ReactNode;
  onMax?: () => void;
  help?: ReactNode;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
};

const DECIMAL = /^\d*(\.\d*)?$/;

/** 56px decimal input with the token on the left and a Max button. Only digits and one dot get through. */
export function AmountInput({ id, label, token, value, onChange, balanceLabel, onMax, help, error, disabled, placeholder = "0.00" }: Props) {
  return (
    <div className="nl-field">
      <label className="nl-field__label" htmlFor={id}>
        {label}
        {balanceLabel && <span>{balanceLabel}</span>}
      </label>
      <div className={["nl-input", error && "nl-input--error"].filter(Boolean).join(" ")}>
        <span className="nl-token">
          <TokenDot symbol={token} />
          {token}
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            if (DECIMAL.test(v)) onChange(v);
          }}
        />
        {onMax && (
          <button type="button" className="nl-max" onClick={onMax} disabled={disabled}>
            Max
          </button>
        )}
      </div>
      {error ? (
        <div id={`${id}-error`} className="nl-field__help nl-field__help--error" role="alert">
          {error}
        </div>
      ) : help ? (
        <div id={`${id}-help`} className="nl-field__help">
          {help}
        </div>
      ) : null}
    </div>
  );
}
