import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftIcon } from '../../components/Icons';
import { useModal } from '../../hooks/useModal';

interface DetailSheetProps {
  onClose: () => void;
  children: ReactNode;
}

/** Mobile only: full-screen group detail with a back button. */
export function DetailSheet({ onClose, children }: DetailSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, true, onClose);

  return createPortal(
    <div ref={ref} className="detail-sheet" role="dialog" aria-modal="true" aria-label="Group details">
      <div className="detail-sheet-bar">
        <button type="button" className="btn btn-ghost" onClick={onClose} data-autofocus>
          <ArrowLeftIcon /> Back to groups
        </button>
      </div>
      <div className="detail-sheet-body">{children}</div>
    </div>,
    document.body,
  );
}
