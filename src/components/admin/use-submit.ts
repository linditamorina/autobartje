"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets a <form action={fn}> after every submit, which wipes what the
 * user typed when validation fails. Submitting through onSubmit keeps the input;
 * the submit button's name/value (e.g. force=1) is still sent.
 */
export function useKeepInputSubmit(dispatch: (form: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}
