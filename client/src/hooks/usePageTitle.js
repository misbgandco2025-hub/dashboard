import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | Task Management` : 'Task Management System';
    return () => { document.title = prev; };
  }, [title]);
};

export default usePageTitle;
