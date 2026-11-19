import { useId, useRef } from 'react'
import { CloseIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import {
  CONTRACT_ID_MAX_LENGTH,
  DOCUMENT_TYPE_MAX_LENGTH,
  KEY_BOUNDS_CLEAR_BUTTON_CLASS,
  KEY_BOUNDS_COPY,
  KEY_BOUNDS_FIELD_INVALID_CLASS,
  KEY_BOUNDS_FIELD_SHELL_CLASS,
  KEY_BOUNDS_FIELD_VALID_CLASS,
  KEY_BOUNDS_GRID_CLASS,
  KEY_BOUNDS_INPUT_CLASS,
} from '@renderer/constants/identityKeys'
import type { KeyBoundsFieldsProps } from '@renderer/types/IdentityKeys'

export default function KeyBoundsFields({ variantLabel, draft, validation, onChange }: KeyBoundsFieldsProps): React.JSX.Element {
  const baseId = useId()
  const contractInputId = `${baseId}-contract`
  const docTypeInputId = `${baseId}-doctype`
  const contractRef = useRef<HTMLInputElement>(null)
  const docTypeRef = useRef<HTMLInputElement>(null)

  return (
    <div className={KEY_BOUNDS_GRID_CLASS}>
      <div className={'flex min-w-0 flex-col gap-1'}>
        <label htmlFor={contractInputId}>
          <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{KEY_BOUNDS_COPY.contractIdLabel}</Text>
        </label>
        <div className={`${KEY_BOUNDS_FIELD_SHELL_CLASS} ${validation.contractIdError != null ? KEY_BOUNDS_FIELD_INVALID_CLASS : KEY_BOUNDS_FIELD_VALID_CLASS}`}>
          <input
            ref={contractRef}
            id={contractInputId}
            type={'text'}
            value={draft.contractId}
            onChange={event => onChange({ contractId: event.target.value })}
            placeholder={KEY_BOUNDS_COPY.contractIdPlaceholder}
            maxLength={CONTRACT_ID_MAX_LENGTH}
            spellCheck={false}
            autoComplete={'off'}
            aria-label={`${variantLabel} ${KEY_BOUNDS_COPY.contractIdLabel}`}
            aria-invalid={validation.contractIdError != null}
            className={`${KEY_BOUNDS_INPUT_CLASS} font-mono`}
          />
          {draft.contractId !== '' && (
            <button
              type={'button'}
              aria-label={KEY_BOUNDS_COPY.clearContractId}
              title={KEY_BOUNDS_COPY.clearContractId}
              onClick={() => {
                onChange({ contractId: '' })
                contractRef.current?.focus()
              }}
              className={KEY_BOUNDS_CLEAR_BUTTON_CLASS}
            >
              <CloseIcon size={10} />
            </button>
          )}
        </div>
        {validation.contractIdError != null && (
          <Text size={10} weight={'medium'} color={'red'}>{validation.contractIdError}</Text>
        )}
      </div>
      <div className={'flex min-w-0 flex-col gap-1'}>
        <label htmlFor={docTypeInputId}>
          <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{KEY_BOUNDS_COPY.documentTypeLabel}</Text>
        </label>
        <div className={`${KEY_BOUNDS_FIELD_SHELL_CLASS} ${validation.documentTypeError != null ? KEY_BOUNDS_FIELD_INVALID_CLASS : KEY_BOUNDS_FIELD_VALID_CLASS}`}>
          <input
            ref={docTypeRef}
            id={docTypeInputId}
            type={'text'}
            value={draft.documentType}
            onChange={event => onChange({ documentType: event.target.value })}
            placeholder={KEY_BOUNDS_COPY.documentTypePlaceholder}
            maxLength={DOCUMENT_TYPE_MAX_LENGTH}
            spellCheck={false}
            autoComplete={'off'}
            aria-label={`${variantLabel} ${KEY_BOUNDS_COPY.documentTypeLabel}`}
            aria-invalid={validation.documentTypeError != null}
            className={KEY_BOUNDS_INPUT_CLASS}
          />
          {draft.documentType !== '' && (
            <button
              type={'button'}
              aria-label={KEY_BOUNDS_COPY.clearDocumentType}
              title={KEY_BOUNDS_COPY.clearDocumentType}
              onClick={() => {
                onChange({ documentType: '' })
                docTypeRef.current?.focus()
              }}
              className={KEY_BOUNDS_CLEAR_BUTTON_CLASS}
            >
              <CloseIcon size={10} />
            </button>
          )}
        </div>
        {validation.documentTypeError != null && (
          <Text size={10} weight={'medium'} color={'red'}>{validation.documentTypeError}</Text>
        )}
      </div>
    </div>
  )
}
