import { KeyIcon, PlusIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ChevronIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import { ADD_MASTERNODE_MODAL_COPY, ADD_MASTERNODE_OPTION_CARD_CLASS } from '@renderer/constants/masternodeNodes'
import { ICON_CHIP } from '@renderer/constants/surfaces'
import { ModalSize } from '@renderer/enums/ModalSize'
import type { AddMasternodeModalProps } from '@renderer/types/MasternodeNodes'

export default function AddMasternodeModal({
  open,
  importedCount,
  onClose,
  onSelectRegister,
  onSelectImport,
}: AddMasternodeModalProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ADD_MASTERNODE_MODAL_COPY.title}
      description={ADD_MASTERNODE_MODAL_COPY.description}
      size={ModalSize.Md}
    >
      <div className={'mt-4 flex flex-col gap-3'}>
        <button
          type={'button'}
          onClick={() => {
            onClose()
            onSelectRegister()
          }}
          className={ADD_MASTERNODE_OPTION_CARD_CLASS}
        >
          <div className={'flex min-w-0 items-start gap-3'}>
            <span className={ICON_CHIP}>
              <PlusIcon size={14} color={'currentColor'} />
            </span>
            <div className={'flex min-w-0 flex-col gap-1'}>
              <Text size={14} weight={'extrabold'} color={'brand'}>{ADD_MASTERNODE_MODAL_COPY.registerTitle}</Text>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
                {ADD_MASTERNODE_MODAL_COPY.registerDescription}
              </Text>
            </div>
          </div>
          <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 shrink-0 dash-text-default opacity-50'} />
        </button>

        <button
          type={'button'}
          onClick={() => {
            onClose()
            onSelectImport()
          }}
          className={ADD_MASTERNODE_OPTION_CARD_CLASS}
        >
          <div className={'flex min-w-0 items-start gap-3'}>
            <span className={ICON_CHIP}>
              <KeyIcon size={14} color={'currentColor'} />
            </span>
            <div className={'flex min-w-0 flex-col gap-1'}>
              <div className={'flex flex-wrap items-center gap-2'}>
                <Text size={14} weight={'extrabold'} color={'brand'}>{ADD_MASTERNODE_MODAL_COPY.importTitle}</Text>
                {importedCount > 0 && (
                  <CustomBadge
                    variant={'accent'}
                    text={`${importedCount} ${ADD_MASTERNODE_MODAL_COPY.importedCountSuffix}`}
                  />
                )}
              </div>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
                {ADD_MASTERNODE_MODAL_COPY.importDescription}
              </Text>
            </div>
          </div>
          <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 shrink-0 dash-text-default opacity-50'} />
        </button>
      </div>
    </Modal>
  )
}
