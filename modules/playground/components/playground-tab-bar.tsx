import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileIcon } from "./file-icon";
import { X } from "lucide-react";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import { usePlaygroundContext } from "@/modules/playground/contexts/playground-context";

type OpenFile = ReturnType<
  typeof useFileExplorer.getState
>["openFiles"][number];

interface PlaygroundTabBarProps {
  paneId: string;
  openFiles: OpenFile[];
  activeFileId: string | null;
  setActiveFileId: (paneId: string, fileId: string) => void;
  closeFile: (paneId: string, fileId: string) => void;
}

export const PlaygroundTabBar = ({
  paneId,
  openFiles,
  activeFileId,
  setActiveFileId,
  closeFile,
}: PlaygroundTabBarProps) => {
  const { editorPanes, setEditorPanes, setActivePaneId } =
    usePlaygroundContext();

  const handleOpenInSplit = (fileId: string) => {
    // If split pane already exists, just activate it
    if (editorPanes.length > 1) {
      setEditorPanes((prev) =>
        prev.map((pane, index) =>
          index === 1 ? { ...pane, activeFileId: fileId } : pane,
        ),
      );

      setActivePaneId(editorPanes[1]?.id || null);
      return;
    }

    // Otherwise create second pane
    const newPaneId = `pane-${Date.now()}`;

    setEditorPanes((prev) => [
      ...prev,
      {
        id: newPaneId,
        activeFileId: fileId,
      },
    ]);

    setActivePaneId(newPaneId);
  };

  if (openFiles.length === 0) return null;

  return (
    <div className="border-b bg-muted/20">
      <Tabs
        value={activeFileId || ""}
        onValueChange={(fileId) => setActiveFileId(paneId, fileId)}
      >
        <div className="flex items-center px-1 pt-1">
          <div className="overflow-x-auto scrollbar-hide flex-1">
            <TabsList
              className="h-9 bg-transparent p-0 inline-flex"
              role="tablist"
            >
              {openFiles.map((file) => {
                const isActive = file.id === activeFileId;
                return (
                  <TabsTrigger
                    key={file.id}
                    value={file.id}
                    role="tab"
                    className={`
                      relative h-9 px-4 text-[13px] border-r border-t rounded-t-lg rounded-b-none 
                      group transition-all duration-200 ease-in-out min-w-[160px] justify-start
                      ${
                        isActive
                          ? "bg-background shadow-sm border-t-primary text-primary font-medium z-10 before:absolute before:inset-x-0 before:-top-px before:h-[2px] before:bg-primary before:rounded-t-lg"
                          : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }
                    `}
                  >
                    <div className="flex items-center w-full min-w-0 gap-2">
                      <FileIcon
                        extension={file.fileExtension}
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                      />
                      <span className="flex-1 min-w-0 truncate text-left">
                        {file.filename}.{file.fileExtension}
                      </span>

                      {/* Status/Close Indicator */}
                      <div className="flex items-center justify-end gap-1 shrink-0 ml-2">
                        {file.hasUnsavedChanges ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 group-hover:hidden transition-all" />
                        ) : null}

                        {paneId === editorPanes[0]?.id && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="
ml-1
px-2
py-0.5
text-[10px]
font-semibold
rounded-md
bg-[#E5484D]
text-white
hover:bg-[#DC3D43]
transition-colors
cursor-pointer
shadow-sm
border border-[#F06A6F]
select-none
shrink-0
"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenInSplit(file.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenInSplit(file.id);
                              }
                            }}
                          >
                            Split View
                          </span>
                        )}

                        <span
                          className={`
                            h-4 w-4 rounded-sm flex items-center justify-center transition-all cursor-pointer
                            hover:bg-destructive/10 hover:text-destructive
                            ${file.hasUnsavedChanges ? "hidden group-hover:flex" : "opacity-0 group-hover:opacity-100"}
                          `}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeFile(paneId, file.id);
                          }}
                          role="button"
                          aria-label={`Close ${file.filename}.${file.fileExtension}`}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
