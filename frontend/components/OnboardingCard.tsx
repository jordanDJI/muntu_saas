"use client";
import { useOnborda } from "onborda";
import type { CardComponentProps } from "onborda";

export default function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const isFirst = currentStep === 1;
  const isLast  = currentStep === totalSteps;

  return (
    <div
      className="relative w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: "var(--bg-nav, #07222F)", border: "1px solid rgba(170,189,216,.18)" }}
    >
      {/* Barre de progression */}
      <div className="h-1 w-full" style={{ background: "rgba(170,189,216,.12)" }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            background: "var(--l-teal-xl, #0D4B58)",
          }}
        />
      </div>

      <div className="p-5">
        {/* Compteur + icône + fermer */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(13,75,88,.5)", color: "#A0D4DC" }}
          >
            {currentStep} / {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {step.icon && (
              <span className="text-2xl leading-none">{step.icon}</span>
            )}
            <button
              onClick={closeOnborda}
              title="Fermer le guide"
              className="w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold transition-colors"
              style={{ background: "rgba(191,51,51,.2)", color: "#FC8181" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(191,51,51,.45)"; e.currentTarget.style.color = "#FCA5A5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(191,51,51,.2)"; e.currentTarget.style.color = "#FC8181"; }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Titre */}
        <h3 className="text-white font-bold text-base leading-snug mb-2">
          {step.title}
        </h3>

        {/* Contenu */}
        <div className="text-sm leading-relaxed" style={{ color: "#AABDD8" }}>
          {step.content}
        </div>

        {/* Navigation */}
        {step.showControls !== false && (
          <div className="flex items-center gap-2 mt-4">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "rgba(255,255,255,.06)", color: "#AABDD8" }}
              >
                ← Précédent
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
              style={{ background: isLast ? "rgba(13,75,88,.9)" : "var(--l-teal-xl, #0D4B58)" }}
            >
              {isLast ? "Terminer ✓" : "Suivant →"}
            </button>
          </div>
        )}
      </div>

      {/* Flèche pointeur */}
      {arrow}
    </div>
  );
}
