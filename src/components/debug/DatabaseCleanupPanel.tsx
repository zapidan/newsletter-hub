import React, { useState, useContext } from "react";
import { AuthContext } from "@common/contexts/AuthContext";
import { useReadingQueue } from "@common/hooks/useReadingQueue";
import {
  dbCleanupUtils,
  DataIntegrityReport,
} from "@common/utils/database/cleanupUtils";

interface CleanupPanelState {
  isLoading: boolean;
  lastReport: DataIntegrityReport | null;
  lastCleanupResult: {
    type: "quick" | "full" | "validation";
    result: any;
  } | null;
  error: string | null;
  operationInProgress: string | null;
}

export const DatabaseCleanupPanel: React.FC = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const { cleanupOrphanedItems, isCleaningUp } = useReadingQueue();

  const [state, setState] = useState<CleanupPanelState>({
    isLoading: false,
    lastReport: null,
    lastCleanupResult: null,
    error: null,
    operationInProgress: null,
  });

  const setLoading = (loading: boolean, operation?: string) => {
    setState((prev) => ({
      ...prev,
      isLoading: loading,
      operationInProgress: loading ? operation || null : null,
      error: loading ? null : prev.error,
    }));
  };

  const setError = (error: string) => {
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
      operationInProgress: null,
    }));
  };

  const handleGenerateReport = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true, "Generating integrity report");

    try {
      const report = await dbCleanupUtils.generateIntegrityReport(user.id);
      setState((prev) => ({
        ...prev,
        lastReport: report,
        isLoading: false,
        operationInProgress: null,
        error: null,
      }));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to generate report",
      );
    }
  };

  const handleQuickCleanup = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true, "Running quick cleanup");

    try {
      const result = await cleanupOrphanedItems();
      setState((prev) => ({
        ...prev,
        lastCleanupResult: { type: "quick", result },
        isLoading: false,
        operationInProgress: null,
        error: null,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Quick cleanup failed");
    }
  };

  const handleFullCleanup = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true, "Running full cleanup");

    try {
      const result = await dbCleanupUtils.performFullCleanup(user.id);
      setState((prev) => ({
        ...prev,
        lastCleanupResult: { type: "full", result },
        isLoading: false,
        operationInProgress: null,
        error: null,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Full cleanup failed");
    }
  };

  const handleValidateIntegrity = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true, "Validating database integrity");

    try {
      const validation = await dbCleanupUtils.validateDatabaseIntegrity(
        user.id,
      );
      setState((prev) => ({
        ...prev,
        lastCleanupResult: { type: "validation", result: validation },
        isLoading: false,
        operationInProgress: null,
        error: null,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Validation failed");
    }
  };

  if (!user) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Please log in to access database cleanup tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-md">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Database Cleanup & Integrity
        </h2>
        <p className="text-gray-600 mt-1">
          Tools for maintaining database integrity and cleaning up orphaned
          data.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={handleGenerateReport}
          disabled={state.isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.operationInProgress === "Generating integrity report"
            ? "Generating..."
            : "Generate Report"}
        </button>

        <button
          onClick={handleQuickCleanup}
          disabled={state.isLoading || isCleaningUp}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.operationInProgress === "Running quick cleanup" || isCleaningUp
            ? "Cleaning..."
            : "Quick Cleanup"}
        </button>

        <button
          onClick={handleFullCleanup}
          disabled={state.isLoading}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.operationInProgress === "Running full cleanup"
            ? "Cleaning..."
            : "Full Cleanup"}
        </button>

        <button
          onClick={handleValidateIntegrity}
          disabled={state.isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.operationInProgress === "Validating database integrity"
            ? "Validating..."
            : "Validate Integrity"}
        </button>
      </div>

      {/* Loading Indicator */}
      {state.isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800">{state.operationInProgress}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-700 mt-1">{state.error}</p>
          <button
            onClick={() => setState((prev) => ({ ...prev, error: null }))}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Integrity Report */}
      {state.lastReport && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Data Integrity Report
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {state.lastReport.orphanedReadingQueueItems}
              </div>
              <div className="text-sm text-gray-600">Orphaned Queue Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {state.lastReport.orphanedNewsletterTags}
              </div>
              <div className="text-sm text-gray-600">Orphaned Tags</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {state.lastReport.orphanedNewsletterSources}
              </div>
              <div className="text-sm text-gray-600">Unused Sources</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${state.lastReport.totalIssues > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {state.lastReport.totalIssues}
              </div>
              <div className="text-sm text-gray-600">Total Issues</div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Generated: {new Date(state.lastReport.timestamp).toLocaleString()}
          </p>
        </div>
      )}

      {/* Cleanup Results */}
      {state.lastCleanupResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-900 mb-3">
            {state.lastCleanupResult.type === "quick" &&
              "Quick Cleanup Results"}
            {state.lastCleanupResult.type === "full" && "Full Cleanup Results"}
            {state.lastCleanupResult.type === "validation" &&
              "Validation Results"}
          </h3>

          {state.lastCleanupResult.type === "quick" && (
            <div>
              <p className="text-green-800">
                Removed {state.lastCleanupResult.result.removedCount} orphaned
                reading queue items
              </p>
            </div>
          )}

          {state.lastCleanupResult.type === "full" && (
            <div className="space-y-2">
              <p className="text-green-800">
                <strong>Reading Queue:</strong> Removed{" "}
                {state.lastCleanupResult.result.readingQueue.itemsRemoved} items
              </p>
              <p className="text-green-800">
                <strong>Newsletter Tags:</strong> Removed{" "}
                {state.lastCleanupResult.result.newsletterTags.itemsRemoved}{" "}
                items
              </p>
              <p className="text-green-800">
                <strong>Total:</strong>{" "}
                {state.lastCleanupResult.result.totalItemsRemoved} items removed
              </p>
              <p className="text-xs text-green-700">
                Completed in{" "}
                {state.lastCleanupResult.result.duration.toFixed(2)}ms
              </p>
              {state.lastCleanupResult.result.totalErrors.length > 0 && (
                <div className="mt-2 p-2 bg-red-100 rounded">
                  <p className="text-red-800 text-sm font-medium">Errors:</p>
                  <ul className="text-red-700 text-sm mt-1">
                    {state.lastCleanupResult.result.totalErrors.map(
                      (error: string, index: number) => (
                        <li key={index}>• {error}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {state.lastCleanupResult.type === "validation" && (
            <div className="space-y-2">
              <p
                className={`font-medium ${state.lastCleanupResult.result.isValid ? "text-green-800" : "text-red-800"}`}
              >
                Database Integrity:{" "}
                {state.lastCleanupResult.result.isValid
                  ? "VALID"
                  : "ISSUES FOUND"}
              </p>
              {state.lastCleanupResult.result.issues.length > 0 && (
                <div>
                  <p className="text-red-800 text-sm font-medium">Issues:</p>
                  <ul className="text-red-700 text-sm mt-1">
                    {state.lastCleanupResult.result.issues.map(
                      (issue: string, index: number) => (
                        <li key={index}>• {issue}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
              {state.lastCleanupResult.result.recommendations.length > 0 && (
                <div>
                  <p className="text-orange-800 text-sm font-medium">
                    Recommendations:
                  </p>
                  <ul className="text-orange-700 text-sm mt-1">
                    {state.lastCleanupResult.result.recommendations.map(
                      (rec: string, index: number) => (
                        <li key={index}>• {rec}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 font-medium mb-2">About These Tools</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>
            <strong>Generate Report:</strong> Analyzes your data for integrity
            issues without making changes
          </li>
          <li>
            <strong>Quick Cleanup:</strong> Removes orphaned reading queue items
            only
          </li>
          <li>
            <strong>Full Cleanup:</strong> Comprehensive cleanup of all orphaned
            data types
          </li>
          <li>
            <strong>Validate Integrity:</strong> Checks database constraints and
            provides recommendations
          </li>
        </ul>
        <p className="text-blue-700 text-xs mt-2">
          <strong>Note:</strong> These operations are safe and only remove data
          that references deleted items.
        </p>
      </div>
    </div>
  );
};

export default DatabaseCleanupPanel;
