import { Text } from '@renderer/components/dash-ui-kit-extended'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { ADD_KEYS_COPY, EMPTY_KEY_BOUNDS_DRAFT, KEY_VARIANT_GROUPS } from '@renderer/constants/identityKeys'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import type { KeyVariantListProps } from '@renderer/types/IdentityKeys'
import { keysOnIdentityLabel, keyVariantCaption, keyVariantTitle } from '@renderer/utils/identityKeySetup'
import { keyRequestLabel, keysMatchingVariant, validateKeyContractBounds, variantRequest } from '@renderer/utils/identityKeyRequests'
import KeyBoundsFields from './KeyBoundsFields'

export default function KeyVariantList({
  existing,
  selected,
  recommended,
  boundsDrafts,
  check,
  onToggle,
  onChangeBounds,
}: KeyVariantListProps): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-2"}>
      {KEY_VARIANT_GROUPS.map(group => (
        <div key={group.label} className={"flex flex-col gap-2"}>
          <Text size={10} weight={"extrabold"} color={"brand"} opacity={50} className={LIST_GROUP_LABEL_CLASS}>{group.label}</Text>
          {group.definitions.map(definition => {
            const checked = selected.includes(definition.variant)
            const onIdentity = keysMatchingVariant(existing, definition.variant)
            const draft = boundsDrafts[definition.variant] ?? EMPTY_KEY_BOUNDS_DRAFT
            const validation = validateKeyContractBounds(draft)
            const title = keyVariantTitle(definition)
            const caption = keyVariantCaption(definition, checked, draft)
            return (
              <CheckRow
                key={definition.variant}
                label={keyRequestLabel(variantRequest(definition.variant, checked ? validation.bounds : null))}
                checked={checked}
                disabled={!checked && check.atLimit}
                onChange={value => onToggle(definition.variant, value)}
                below={checked && definition.canBind ? (
                  <KeyBoundsFields
                    variantLabel={title}
                    draft={draft}
                    validation={validation}
                    onChange={patch => onChangeBounds(definition.variant, patch)}
                  />
                ) : undefined}
              >
                <div className={"grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3"}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"truncate"}>{title}</Text>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={`truncate ${caption.mono ? 'font-mono' : ''}`}>
                    {caption.text}
                  </Text>
                  <div className={"flex items-center justify-end gap-2"}>
                    {onIdentity > 0 && (
                      <Text size={10} weight={"medium"} color={"brand"} opacity={50} className={"whitespace-nowrap"}>{keysOnIdentityLabel(onIdentity)}</Text>
                    )}
                    {recommended.includes(definition.variant) && <CustomBadge variant={"accent"} text={ADD_KEYS_COPY.recommended} />}
                  </div>
                </div>
              </CheckRow>
            )
          })}
        </div>
      ))}
    </div>
  )
}
