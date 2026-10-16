"use client";

import { useState, type FormEvent } from "react";
import { PROVINCES } from "@/lib/site";
import { progress, useProgress } from "@/lib/store";
import { QufooGuide, signUpGuide } from "../Mascot";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { QrGlyph } from "./QrGlyph";

const STEPS = 3; // name → province → ready

/**
 * First-launch sign-up, one question per screen: name, then province, then a short how-to-play.
 * A returning player who has a name but no province starts at the province step. Qufoo stands above
 * the Next button saying what to do on each step.
 */
export function Onboarding() {
  const saved = useProgress();
  const [step, setStep] = useState(saved.name ? 1 : 0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [name, setName] = useState(saved.name);
  const [province, setProvince] = useState(saved.province);

  const canNext = step === 0 ? name.trim() !== "" : step === 1 ? province !== "" : true;

  function go(to: number) {
    setDir(to > step ? "fwd" : "back");
    setStep(to);
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (!canNext) return;
    if (step < STEPS - 1) go(step + 1);
    else progress.start(name, province);
  }

  return (
    <form className="wizard" onSubmit={next}>
      <div className="wizard__top">
        {/* Always shown so the header stays balanced; inactive on the first step. */}
        <button
          type="button"
          className="icon-btn"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          aria-label="Back"
        >
          <ArrowLeftIcon />
        </button>
        <div
          className="wizard__progress"
          role="progressbar"
          aria-label="Sign-up progress"
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step + 1}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i <= step ? "is-done" : undefined}></span>
          ))}
        </div>
        <span className="wizard__count">
          {step + 1}/{STEPS}
        </span>
      </div>

      {/* Re-keyed per step so each screen plays its slide-in. */}
      <div key={step} className={`wizard__step wizard__step--${dir}${step === 2 ? " wizard__step--center" : ""}`}>
        {step === 0 && (
          <>
            <p className="eyebrow">QR Code Hunt</p>
            <h1>
              <label htmlFor="hunter-name">What&apos;s your name?</label>
            </h1>
            <p className="wizard__lead">This is the name other users will see.</p>
            <input
              id="hunter-name"
              className="wizard__input"
              value={name}
              maxLength={20}
              placeholder="Your name"
              autoComplete="nickname"
              enterKeyHint="next"
              onChange={(e) => setName(e.target.value)}
            />
          </>
        )}

        {step === 1 && (
          <>
            <p className="eyebrow">Hi, {name.trim()}!</p>
            <h1 id="province-q">Which province are you in?</h1>
            <p className="wizard__lead">Pick where you&apos;re joining the summit from.</p>
            <div className="choices" role="radiogroup" aria-labelledby="province-q">
              {PROVINCES.map((p) => (
                <label key={p} className={province === p ? "choice is-selected" : "choice"}>
                  <input
                    type="radio"
                    name="province"
                    value={p}
                    checked={province === p}
                    onChange={() => setProvince(p)}
                  />
                  <span>{p}</span>
                  <i className="choice__dot" aria-hidden="true"></i>
                </label>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* A QR code floating inside scanner brackets: what players will be hunting for. */}
            <div className="qr-float" aria-hidden="true">
              <span className="qr-float__corner"></span>
              <span className="qr-float__corner"></span>
              <span className="qr-float__corner"></span>
              <span className="qr-float__corner"></span>
              <div className="qr-float__card">
                <QrGlyph className="qr-float__code" />
                <span className="qr-float__beam"></span>
              </div>
              <span className="qr-float__shadow"></span>
            </div>
            <p className="eyebrow">You&apos;re all set</p>
            <h1>Ready, {name.trim()}?</h1>
            <p className="wizard__lead">
              Hunting for <b>{province}</b>.
            </p>
          </>
        )}
      </div>

      <div className="wizard__foot">
        <QufooGuide text={signUpGuide(step, name)} />
        <button type="submit" className="btn btn--primary btn--block" disabled={!canNext}>
          {step < STEPS - 1 ? (
            <>
              Next
              <ArrowRightIcon />
            </>
          ) : (
            "Let's Go"
          )}
        </button>
      </div>
    </form>
  );
}
