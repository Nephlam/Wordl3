"use client";

import { useState } from "react";

interface TutorialProps {
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Wordl3!",
    description:
      "Guess the daily word in 5 tries. Words can be letters AND numbers, from 1 to 15 characters long.",
    example: "Example: ISA88, GMP, HISTORIAN, 42",
  },
  {
    title: "How to Play",
    description:
      "Type your guess using the on‑screen keyboard or your physical keyboard. Press Enter to submit. Use Backspace to delete.",
    example: "Each guess must be the exact length of today's word.",
  },
  {
    title: "Tile Colours",
    description:
      "After each guess, the tiles will flip to show how close you are.",
    example: (
      <div className="flex gap-2 mt-2">
        <div className="w-10 h-10 bg-correct border-2 border-correct text-white flex items-center justify-center font-bold rounded">I</div>
        <div className="w-10 h-10 bg-present border-2 border-present text-white flex items-center justify-center font-bold rounded">S</div>
        <div className="w-10 h-10 bg-absent border-2 border-absent text-white flex items-center justify-center font-bold rounded">X</div>
      </div>
    ),
  },
  {
    title: "Hint & Explanation",
    description:
      "A hint is shown above the board. After you solve (or run out of attempts), an educational explanation appears so you learn something new.",
    example: null,
  },
];

export default function Tutorial({ onClose }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const next = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-dark border border-brand-mid rounded-xl p-6 max-w-sm w-full text-brand-light shadow-2xl animate-fade-in-up">
        {/* Step counter */}
        <p className="text-xs text-brand-peach mb-2">
          {currentStep + 1} of {TUTORIAL_STEPS.length}
        </p>

        <h2 className="text-xl font-bold mb-3 text-brand-orange">
          {step.title}
        </h2>
        <p className="text-sm mb-3">{step.description}</p>

        {step.example && (
          <div className="text-xs text-brand-mid mb-4">{step.example}</div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="text-xs text-brand-mid hover:text-brand-light underline transition-colors"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="ml-auto bg-brand-orange hover:bg-brand-peach text-brand-dark font-bold py-2 px-4 rounded text-sm transition-colors"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? "Got it!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}