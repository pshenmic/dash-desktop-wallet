import { Fragment, useState } from "react";
import { Button, Text, CheckIcon } from "@renderer/components/dash-ui-kit-extended";
import { ProgressStepBar } from "@renderer/components/dash-ui-kit-extended/progressStepBar";
import Spinner from "@renderer/components/ui/Spinner";
import { TRANSFER_WIZARD_CTA_CLASS, TRANSFER_WIZARD_LABELS } from "@renderer/constants/transferWizard";
import type { TransferWizardProps } from "@renderer/types/TransferWizard";

export default function TransferWizard({
  steps,
  onSubmit,
  submitLabel = TRANSFER_WIZARD_LABELS.submit,
  submitDisabled = false,
  submitBusy = false,
  currentStep,
  allowStepClick = false,
  footerNotice,
  onStepChange,
}: TransferWizardProps): React.JSX.Element {
  const [internalStep, setInternalStep] = useState(0)
  const current = currentStep ?? internalStep
  const step = steps[current]
  const isLast = current === steps.length - 1

  const goTo = (index: number): void => {
    if (currentStep === undefined) setInternalStep(index)
    onStepChange?.(index)
  }

  return (
    <div className={"flex-1 min-h-0 flex justify-center"}>
      <div className={"w-full max-w-170 min-w-0 flex flex-col"}>
        <ol className={"flex items-center"}>
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            const clickable = allowStepClick && done && !submitBusy
            const stepBody = (
              <>
                <span className={`size-9 shrink-0 rounded-full border flex items-center justify-center ${active || done ? 'border-dash-brand dark:border-dash-mint bg-dash-brand/5 dark:bg-dash-mint/5' : 'border-dash-primary-dark-blue/15 dark:border-white/15'}`}>
                  {done
                    ? <CheckIcon size={14} color={"currentColor"} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                    : <Text size={14} weight={"medium"} color={active ? 'blue-mint' : 'brand'} opacity={active ? 100 : 50}>{i + 1}</Text>}
                </span>
                <Text size={14} weight={active ? 'extrabold' : 'medium'} color={active || done ? 'blue-mint' : 'brand'} opacity={active || done ? 100 : 50} className={"whitespace-nowrap"}>{s.label}</Text>
              </>
            )
            return (
              <Fragment key={s.label}>
                <li className={"flex shrink-0 items-center gap-2"} aria-current={active ? 'step' : undefined}>
                  {clickable ? (
                    <button
                      type={"button"}
                      onClick={() => goTo(i)}
                      className={"flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"}
                    >
                      {stepBody}
                    </button>
                  ) : stepBody}
                </li>
                {i < steps.length - 1 && <li aria-hidden={"true"} className={"h-px flex-1 mx-3 bg-dash-primary-dark-blue/10 dark:bg-white/10"} />}
              </Fragment>
            )
          })}
        </ol>

        <div className={"mt-8 flex flex-col gap-4"} key={current}>
          {step.content}
        </div>

        {footerNotice}

        <div className={"mt-8 flex gap-2"}>
          {current > 0 && (
            <Button
              type={"button"}
              disabled={submitBusy}
              onClick={() => goTo(current - 1)}
              variant={"outline"}
              colorScheme={"primary-light"}
              size={"md"}
              className={TRANSFER_WIZARD_CTA_CLASS}
            >
              {TRANSFER_WIZARD_LABELS.back}
            </Button>
          )}
          {isLast ? (
            <Button type={"button"} onClick={onSubmit} disabled={submitDisabled || submitBusy} size={"md"} colorScheme={"lightBlue-mint"} className={`${TRANSFER_WIZARD_CTA_CLASS} gap-2`}>
              {submitBusy && <Spinner size={16} className={"text-current"} />}
              {submitLabel}
            </Button>
          ) : (
            <Button type={"button"} onClick={() => goTo(current + 1)} disabled={step.canAdvance === false} size={"md"} colorScheme={"lightBlue-mint"} className={TRANSFER_WIZARD_CTA_CLASS}>
              {TRANSFER_WIZARD_LABELS.continue}
            </Button>
          )}
        </div>
        <ProgressStepBar currentStep={current + 1} totalSteps={steps.length} color={"blue-mint"} className={"mt-3"} />
      </div>
    </div>
  )
}
