import { create } from 'zustand';
import { getDocumentTypes, getStatusOptions } from '../services/configService';

const useConfigStore = create((set, get) => ({
  bankLoanDocuments: [],
  subsidyDocuments: [],
  bankLoanStatuses: [],
  subsidyStatuses: [],
  loading: false,

  fetchConfigurations: async () => {
    if (get().bankLoanStatuses.length > 0) return; // cached
    set({ loading: true });
    try {
      const [blDocs, subDocs, blStatuses, subStatuses] = await Promise.all([
        getDocumentTypes('bank-loan'),
        getDocumentTypes('subsidy'),
        getStatusOptions('bank-loan'),
        getStatusOptions('subsidy'),
      ]);
      set({
        bankLoanDocuments: blDocs.data?.data ?? [],
        subsidyDocuments: subDocs.data?.data ?? [],
        bankLoanStatuses: blStatuses.data?.data ?? [],
        subsidyStatuses: subStatuses.data?.data ?? [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  invalidate: () =>
    set({
      bankLoanDocuments: [],
      subsidyDocuments: [],
      bankLoanStatuses: [],
      subsidyStatuses: [],
    }),
}));

export default useConfigStore;
