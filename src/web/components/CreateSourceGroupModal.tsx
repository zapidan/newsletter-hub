import { useNewsletterSourceGroups } from "@common/hooks/useNewsletterSourceGroups";
import { NewsletterSource } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface CreateSourceGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sources: NewsletterSource[];
  groupToEdit?: {
    id: string;
    name: string;
    sources: NewsletterSource[];
  } | null;
}

export const CreateSourceGroupModal = ({
  isOpen,
  onClose,
  onSuccess,
  sources,
  groupToEdit,
}: CreateSourceGroupModalProps) => {
  const [name, setName] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const log = useLogger();

  const {
    createGroup,
    updateGroup,
    isPending: isSaving,
  } = useNewsletterSourceGroups();

  // Initialize form when opening modal or when groupToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (groupToEdit) {
        setName(groupToEdit.name);
        setSelectedSourceIds(new Set(groupToEdit.sources.map((s) => s.id)));
      } else {
        setName("");
        setSelectedSourceIds(new Set());
      }
      setSearchTerm("");
    }
  }, [isOpen, groupToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;

    try {
      if (groupToEdit) {
        await updateGroup.mutateAsync({
          id: groupToEdit.id,
          name: name.trim(),
          sourceIds: Array.from(selectedSourceIds),
        });
      } else {
        await createGroup.mutateAsync({
          name: name.trim(),
          sourceIds: Array.from(selectedSourceIds),
        });
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      log.error(
        "Failed to save source group",
        {
          action: "save_source_group",
          metadata: {
            groupId: groupToEdit?.id,
            isEdit: !!groupToEdit,
            sourceCount: selectedSourceIds.size,
          },
        },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  const toggleSource = (sourceId: string) => {
    const newSelected = new Set(selectedSourceIds);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedSourceIds(newSelected);
  };

  const filteredSources = sources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.from.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Form is valid if name is not empty and at least one source is selected
  const isFormValid = name.trim().length > 0 && selectedSourceIds.size > 0;
  const isSubmitDisabled = !isFormValid || isSaving;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden p-6 relative border border-gray-200 dark:border-neutral-800"
        style={{
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "32rem",
          maxHeight: "90vh",
          overflow: "hidden",
          position: "relative",
          zIndex: 10000,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            {groupToEdit ? "Edit Group" : "Create New Group"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-slate-200 dark:hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="pt-4 pb-4 space-y-4">
            <div>
              <label
                htmlFor="group-name"
                className="block text-base font-medium text-gray-700 dark:text-slate-200 mb-2"
              >
                Group Name
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-neutral-800 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-colors text-base"
                placeholder="e.g., Tech News, Personal, etc."
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-base font-medium text-gray-700 dark:text-slate-200">
                  Sources ({selectedSourceIds.size} selected)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm p-2 pl-3 pr-8 border border-gray-200 dark:border-neutral-700 rounded-lg w-56 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-neutral-800 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-colors"
                    placeholder="Search sources..."
                  />
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-300 dark:hover:text-slate-100 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 max-h-60 overflow-y-auto">
                {filteredSources.length > 0 ? (
                  <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {filteredSources.map((source) => (
                      <li
                        key={source.id}
                        className="hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors"
                        onClick={() => toggleSource(source.id)}
                      >
                        <div className="relative flex items-center px-4 py-3 cursor-pointer">
                          <div className="flex items-center h-5">
                            <div className={`flex items-center justify-center h-5 w-5 rounded border ${selectedSourceIds.has(source.id) ? 'bg-blue-50 border-blue-400' : 'border-gray-300 dark:border-neutral-700'}`}>
                              {selectedSourceIds.has(source.id) && (
                                <svg className="h-3.5 w-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-slate-200">
                              {source.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-300">
                              {source.from}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-300 bg-gray-50 dark:bg-neutral-900">
                    {sources.length === 0
                      ? "No sources available. Add some sources first."
                      : "No sources match your search."}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 pb-2 bg-gray-50 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`px-5 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitDisabled
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
                }`}
              title={
                isSubmitDisabled
                  ? !name.trim()
                    ? "Please enter a group name"
                    : selectedSourceIds.size === 0
                      ? "Please select at least one source"
                      : ""
                  : ""
              }
            >
              {isSaving ? (
                "Saving..."
              ) : groupToEdit ? (
                "Update Group"
              ) : (
                <>
                  <Plus className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                  Create Group
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
