import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title=""
    size="sm"
    closeOnBackdrop={!loading}
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>
    }
  >
    <div className="flex flex-col items-center text-center py-4 gap-3">
      <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-danger-50' : 'bg-warning-50'}`}>
        <AlertTriangle className={`h-7 w-7 ${variant === 'danger' ? 'text-danger-500' : 'text-warning-500'}`} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  </Modal>
);

export default ConfirmDialog;
