import { useRef, useState } from 'react';

export function useFormValidation() {
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  function validate(nextErrors) {
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return false;
    }
    return true;
  }
  return { errors, formRef, validate };
}
