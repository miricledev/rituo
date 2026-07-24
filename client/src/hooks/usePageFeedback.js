import { useState } from 'react';

const usePageFeedback = () => {
  const [pageToast, setPageToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showPageToast = (type, title, message = '') => {
    setPageToast({ type, title, message });
  };

  const clearPageToast = () => {
    setPageToast(null);
  };

  const requestConfirmation = ({
    title,
    message,
    confirmLabel,
    confirmClassName,
    onConfirm
  }) => {
    setConfirmDialog({
      title,
      message,
      confirmLabel,
      confirmClassName,
      onConfirm
    });
  };

  const clearConfirmation = () => {
    setConfirmDialog(null);
  };

  return {
    pageToast,
    confirmDialog,
    showPageToast,
    clearPageToast,
    requestConfirmation,
    clearConfirmation
  };
};

export default usePageFeedback;
