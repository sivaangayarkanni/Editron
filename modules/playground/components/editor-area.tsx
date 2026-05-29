"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PlaygroundTabBar } from "@/modules/playground/components/playground-tab-bar";
import { Breadcrumbs } from "@/modules/playground/components/breadcrumbs";
import { StatusBar } from "@/modules/playground/components/status-bar";
import { WelcomeScreen } from "@/modules/playground/components/welcome-screen";
import WebContainerPreview from "@/modules/webcontainers/components/webcontainer-preview";
import { CodeTimeTravel } from "@/frontend/src/components/CodeTimeTravel";
import { usePlaygroundContext } from "@/modules/playground/contexts/playground-context";
import { usePlaygroundUI } from "@/modules/playground/hooks/usePlaygroundUI";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import { useGitHistory } from "@/modules/playground/hooks/useGitHistory";
import { useAI } from "@/modules/playground/hooks/useAI";
import type {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";
import { useCollaboratorCount } from "@/modules/playground/hooks/useCollaboratorCount";
import { useYjsWebContainerSync } from "@/modules/playground/hooks/useYjsWebContainerSync";

const PlaygroundEditor = dynamic(
  () => import("@/modules/playground/components/playground-editor"),
  { ssr: false }
);

interface EditorAreaProps {
  handleDownloadZip: () => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  handleDownloadZip,
}) => {
  const {
    id,
    templateData,
    playgroundData,
    instance,
    writeFileSync,
    serverUrl,
    containerLoading,
    containerError,
  } = usePlaygroundContext();

  const {
    openFiles,
    activeFileId,
    setActiveFileId,
    closeFile,
    openFile,
    updateFileContent,
    
    // Split View State
    splitLayout,
    setSplitLayout,
    focusedPane,
    setFocusedPane,
    primaryPaneFiles,
    secondaryPaneFiles,
    secondaryActiveFileId,
  } = useFileExplorer();

  const {
    isPreviewVisible,
    setIsPreviewVisible,
    isTimeTravelOpen,
    cursorPosition,
    setCursorPosition,
    setIsCommandPaletteOpen,
  } = usePlaygroundUI();

  const {
    commits,
    isLoading: gitLoading,
    currentCommitHash,
    checkoutCommit,
    fetchCommits,
  } = useGitHistory(instance);

  const { openChat } = useAI();

  const activeFile = openFiles.find((file) => file.id === activeFileId);
  const secondaryActiveFile = openFiles.find((file) => file.id === secondaryActiveFileId);
  const collaboratorCount = useCollaboratorCount(id);

  // Handle time travel to a specific commit
  const handleTravelBack = async (commitId: string) => {
    const commit = commits.find((c) => c.id === commitId);
    if (!commit) return;

    try {
      toast.loading("Traveling back in time...", { id: "time-travel" });
      const success = await checkoutCommit(commit.hash);

      if (success) {
        toast.success(`Traveled to: ${commit.message}`, { id: "time-travel" });
        
        // Reload all open files to reflect the checked-out state
        if (instance && writeFileSync) {
          for (const file of openFiles) {
            try {
              const filePath = `${file.filename}.${file.fileExtension}`;
              const readProcess = await instance.spawn("cat", [filePath]);
              let content = "";
              readProcess.output.pipeTo(
                new WritableStream({
                  write(data) {
                    content += data;
                  },
                })
              );
              await readProcess.exit;
              updateFileContent(file.id, content);
            } catch (err) {
              console.error(`Failed to reload file ${file.filename}:`, err);
            }
          }
        }
      } else {
        toast.error("Failed to travel back", { id: "time-travel" });
      }
    } catch (err) {
      console.error("Time travel error:", err);
      toast.error("Time travel failed", { id: "time-travel" });
    }
  };

  // Handle AI explanation of a commit
  const handleExplainWithAI = (commitId: string) => {
    const commit = commits.find((c) => c.id === commitId);
    if (!commit) return;

    // Open AI chat with a pre-filled prompt
    openChat();
    
    // Use a timeout to ensure the chat is open before sending the message
    setTimeout(() => {
      const aiState = useAI.getState();
      aiState.addMessage({
        role: "user",
        content: `Explain this git commit:\n\nCommit: ${commit.hash}\nAuthor: ${commit.author}\nDate: ${commit.date.toLocaleString()}\nMessage: ${commit.message}\n\nPlease analyze what changes were likely made in this commit and why they might be important.`,
      });
    }, 100);
  };
  // Sync Yjs remote changes directly to WebContainer for live preview
  useYjsWebContainerSync(id, templateData, writeFileSync);

  // Auto-open default file when preview is shown if no file is open
  useEffect(() => {
    if (isPreviewVisible && !activeFileId && templateData) {
      const findDefaultFile = (
        items: (TemplateFile | TemplateFolder)[]
      ): TemplateFile | null => {
        for (const item of items) {
          if (!("folderName" in item)) {
            if (
              [
                "App.tsx",
                "App.jsx",
                "index.tsx",
                "index.jsx",
                "index.js",
                "main.tsx",
                "main.js",
                "index.html",
              ].includes(`${item.filename}.${item.fileExtension}`)
            ) {
              return item;
            }
          } else {
            const found = findDefaultFile(item.items);
            if (found) return found;
          }
        }
        return null;
      };

      const defaultFile = findDefaultFile(templateData.items);
      if (defaultFile) {
        openFile(defaultFile);
      }
    }
  }, [isPreviewVisible, activeFileId, templateData, openFile]);

  const containerStatus: "idle" | "building" | "running" | "error" =
    containerError
      ? "error"
      : containerLoading
        ? "building"
        : serverUrl
          ? "running"
          : "idle";

  const primaryTabs = openFiles.filter(f => primaryPaneFiles.includes(f.id));
  const secondaryTabs = openFiles.filter(f => secondaryPaneFiles.includes(f.id));

  const toggleSplitLayout = () => {
    setSplitLayout(splitLayout === 'none' ? 'horizontal' : splitLayout === 'horizontal' ? 'vertical' : 'none');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex-1 min-h-0">
        {openFiles.length > 0 ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0" role="tabpanel">
              <ResizablePanelGroup
                direction="horizontal"
                className="h-full"
              >
                <ResizablePanel
                  defaultSize={isPreviewVisible ? 50 : isTimeTravelOpen ? 75 : 100}
                >
                  <ErrorBoundary
                    name="MonacoEditor"
                    fallback={({ reset }) => (
                      <div className="flex h-full min-h-[200px] items-center justify-center p-6">
                        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
                          <h3 className="mb-2 text-lg font-semibold text-destructive">
                            Editor crashed
                          </h3>
                          <p className="mb-4 text-sm text-muted-foreground">
                            The editor failed, but the rest of the
                            playground is still available.
                          </p>
                          <Button onClick={reset}>Reload Editor</Button>
                        </div>
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Editors Area */}
                <ResizablePanel defaultSize={isPreviewVisible ? 50 : 100} className="flex flex-col h-full bg-background min-w-0">
                  <ResizablePanelGroup direction={splitLayout === 'vertical' ? 'vertical' : 'horizontal'} className="h-full">
                    
                    {/* Primary Pane */}
                    <ResizablePanel defaultSize={splitLayout !== 'none' ? 50 : 100} className="flex flex-col h-full min-w-[200px] min-h-[100px]">
                      <PlaygroundTabBar
                        openFiles={primaryTabs}
                        activeFileId={activeFileId}
                        setActiveFileId={(id) => setActiveFileId(id, 'primary')}
                        closeFile={(id) => closeFile(id, 'primary')}
                        onSplit={toggleSplitLayout}
                        splitLayout={splitLayout}
                        isFocused={focusedPane === 'primary'}
                        onFocus={() => setFocusedPane('primary')}
                      />
                      <Breadcrumbs activeFile={activeFile} templateData={templateData} />
                      <div className="flex-1 min-h-0 relative" onClickCapture={() => setFocusedPane('primary')}>
                        {activeFileId && primaryTabs.length > 0 ? (
                          <ErrorBoundary
                            name="MonacoEditor-Primary"
                            fallback={({ reset }) => (
                              <div className="flex h-full items-center justify-center p-6"><Button onClick={reset}>Reload Editor</Button></div>
                            )}
                          >
                            <PlaygroundEditor
                              activeFile={activeFile}
                              content={activeFile?.content || ""}
                              onContentChange={(value) => activeFileId && updateFileContent(activeFileId, value)}
                              onCursorChange={(line, col) => setCursorPosition({ line, col })}
                            />
                          </ErrorBoundary>
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground/50 text-sm">
                            <span className="font-mono">Open a file in Primary Pane</span>
                          </div>
                        )}
                      </div>
                    </ResizablePanel>

                    {/* Secondary Pane */}
                    {splitLayout !== 'none' && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={50} className="flex flex-col h-full min-w-[200px] min-h-[100px]">
                          <PlaygroundTabBar
                            openFiles={secondaryTabs}
                            activeFileId={secondaryActiveFileId}
                            setActiveFileId={(id) => setActiveFileId(id, 'secondary')}
                            closeFile={(id) => closeFile(id, 'secondary')}
                            onSplit={toggleSplitLayout}
                            splitLayout={splitLayout}
                            isFocused={focusedPane === 'secondary'}
                            onFocus={() => setFocusedPane('secondary')}
                          />
                          <Breadcrumbs activeFile={secondaryActiveFile} templateData={templateData} />
                          <div className="flex-1 min-h-0 relative" onClickCapture={() => setFocusedPane('secondary')}>
                            {secondaryActiveFileId && secondaryTabs.length > 0 ? (
                              <ErrorBoundary
                                name="MonacoEditor-Secondary"
                                fallback={({ reset }) => (
                                  <div className="flex h-full items-center justify-center p-6"><Button onClick={reset}>Reload Editor</Button></div>
                                )}
                              >
                                <PlaygroundEditor
                                  activeFile={secondaryActiveFile}
                                  content={secondaryActiveFile?.content || ""}
                                  onContentChange={(value) => secondaryActiveFileId && updateFileContent(secondaryActiveFileId, value)}
                                  onCursorChange={(line, col) => setCursorPosition({ line, col })}
                                />
                              </ErrorBoundary>
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground/50 text-sm">
                                <span className="font-mono">Open a file in Secondary Pane</span>
                              </div>
                            )}
                          </div>
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </ResizablePanel>

                {/* Preview Area */}
                {isPreviewVisible && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50} className="min-w-[300px]">
                      {templateData ? (
                        <WebContainerPreview
                          templateData={templateData}
                          instance={instance}
                          writeFileSync={writeFileSync || (async () => {})}
                          error={containerError}
                          serverUrl={serverUrl || ""}
                          forceResetup={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-6 bg-muted/10">
                          {containerError ? (
                            <p className="text-destructive text-sm font-medium">Failed to load preview container.</p>
                          ) : (
                            <p className="text-muted-foreground text-sm">Loading preview environment...</p>
                          )}
                        </div>
                      )}
                    </ResizablePanel>
                  </>
                )}
                {isTimeTravelOpen && (
                  <>
                    {!isPreviewVisible && <ResizableHandle />}
                    <ResizablePanel 
                      defaultSize={25}
                      minSize={20}
                      maxSize={40}
                      className={`transition-all duration-300 ${isTimeTravelOpen ? "animate-slideInRight" : ""}`}
                    >
                      <CodeTimeTravel
                        commits={commits.map((c) => ({
                          id: c.id,
                          message: c.message,
                          date: c.date,
                          author: c.author,
                          hash: c.hash,
                        }))}
                        onTravelBack={handleTravelBack}
                        onExplainWithAI={handleExplainWithAI}
                        isLoading={gitLoading}
                        activeCommitId={
                          commits.find((c) => c.hash === currentCommitHash)?.id
                        }
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          </div>
        ) : (
          <WelcomeScreen
            projectTitle={playgroundData?.title}
            onTogglePreview={() => setIsPreviewVisible(true)}
            onOpenAI={() => useAI.getState().toggleChat()}
            onDownload={handleDownloadZip}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        )}
      </div>

      <StatusBar
        activeFile={focusedPane === 'primary' ? activeFile : secondaryActiveFile}
        cursorPosition={cursorPosition}
        containerStatus={containerStatus}
        collaboratorCount={collaboratorCount}
        openFileCount={openFiles.length}
      />
    </div>
  );
};
