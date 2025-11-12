import React, { useMemo } from 'react';
import { ValidationIssue } from '../types';
import { WarningIcon } from './icons/WarningIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  onIssueClick: (issue: ValidationIssue) => void;
}

const IssueCategory: React.FC<{
  title: string;
  issues: ValidationIssue[];
  iconColor: string;
  onIssueClick: (issue: ValidationIssue) => void;
}> = ({ title, issues, iconColor, onIssueClick }) => (
  <details className="group" open>
    <summary className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-slate-700/50 list-none">
      <div className="flex items-center">
        <WarningIcon className={`h-4 w-4 mr-2 ${iconColor}`} />
        <span className="font-semibold text-sm text-slate-300">{title}</span>
        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-slate-700 text-slate-300 rounded-full">{issues.length}</span>
      </div>
      <ChevronDownIcon className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform" />
    </summary>
    <div className="pl-5 pr-2 pt-1 pb-2 border-l-2 border-slate-700 ml-2.5 space-y-1">
      {issues.map((issue, index) => (
        <div
          key={index}
          onClick={() => onIssueClick(issue)}
          className="p-2 rounded-lg cursor-pointer transition-colors bg-slate-800/50 hover:bg-slate-700/50"
        >
          <p className="text-sm font-semibold text-slate-300">
            Row {issue.formIndex + 1}: <span className="font-bold">{issue.field}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{issue.message}</p>
        </div>
      ))}
    </div>
  </details>
);

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ issues, onIssueClick }) => {
  const categorizedIssues = useMemo(() => {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.type]) {
        acc[issue.type] = [];
      }
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<ValidationIssue['type'], ValidationIssue[]>);
  }, [issues]);

  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex flex-col space-y-2 pt-4 border-t border-slate-700/50 min-h-0">
      <h3 className="text-md font-semibold text-white flex items-center">
        <span className="flex items-center justify-center h-7 w-7 mr-3 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
          <WarningIcon className="h-4 w-4 text-white" />
        </span>
        Validation Issues
        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-300 rounded-full animate-pulse-red">
          {issues.length}
        </span>
      </h3>
      <div className="overflow-y-auto space-y-1 pr-2 -mr-2 max-h-48">
        {categorizedIssues.missing && (
          <IssueCategory title="Missing Fields" issues={categorizedIssues.missing} iconColor="text-red-500" onIssueClick={onIssueClick} />
        )}
        {categorizedIssues.format && (
          <IssueCategory title="Format Errors" issues={categorizedIssues.format} iconColor="text-orange-500" onIssueClick={onIssueClick} />
        )}
        {categorizedIssues.confidence && (
          <IssueCategory title="Low Confidence" issues={categorizedIssues.confidence} iconColor="text-amber-500" onIssueClick={onIssueClick} />
        )}
      </div>
    </div>
  );
};