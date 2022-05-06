import deepcopy from "deepcopy";
import { useCommander } from "~/plugins";
import type { VisualEditorBlockData, VisualEditorModelValue } from "~/types";

export function useVisualCommand(
  {
    focusData,
    updateBlocks,
    dataModel,
    dragstart,
    dragend,
  }: {
    focusData: { value: { focus: VisualEditorBlockData[]; unFocus: VisualEditorBlockData[] } };
    updateBlocks: (blocks: VisualEditorBlockData[]) => void;
    dataModel: { value: VisualEditorModelValue };
    dragstart: { on: (cb: () => void) => void; off: (cb: () => void) => void };
    dragend: { on: (cb: () => void) => void; off: (cb: () => void) => void };
  },
) {
  const commander = useCommander();

  commander.registry({
    name: "delete",
    keyboard: ["backspace", "delete", "ctrl+d"],
    execute: () => {
      console.log("执行删除命令");
      const data = {
        before: dataModel.value.blocks || [],
        after: focusData.value.unFocus,
      };
      return {
        redo: () => {
          console.log("重做删除命令");
          updateBlocks(data.after);
        },
        undo: () => {
          console.log("撤回删除命令");
          updateBlocks(data.before);
        },
      };
    },
  });

  commander.registry({
    name: "drag",
    init() {
      this.data = {
        before: null as null | VisualEditorBlockData[],
        after: null as null | VisualEditorBlockData[],
      };
      const handler = {
        dragstart: () => this.data.before = deepcopy(dataModel.value.blocks || []),
        dragend: () => commander.state.commands.drag(),
      };
      dragstart.on(handler.dragstart);
      dragend.on(handler.dragend);

      return () => {
        dragstart.off(handler.dragstart);
        dragstart.off(handler.dragend);
      };
    },
    execute() {
      const before = this.data.before;
      const after = deepcopy(dataModel.value.blocks || []);
      return {
        redo: () => {
          updateBlocks(deepcopy(after));
        },
        undo: () => {
          updateBlocks(deepcopy(before));
        },
      };
    },
  });

  commander.init();

  return {
    undo: () => commander.state.commands.undo(),
    redo: () => commander.state.commands.redo(),
    delete: () => commander.state.commands.delete(),
    drag: () => commander.state.commands.drag(),
  };
}