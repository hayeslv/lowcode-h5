import "./index.scss";
import type { PropType } from "vue";
import { ref, computed, defineComponent } from "vue";
import type { VisualEditorBlockData, VisualEditorComponent, VisualEditorModelValue } from "~/types/visual-editor";
import { useModel } from "./hooks/useModel";
import { VisualEditorBlock } from "../visual-editor-block";
import type { VisualEditorConfig } from "~/utils";
import { $$dialog, useVisualCommand, createNewBlock } from "~/utils";
import { createEvent } from "~/plugins/event";
import { ElNotification } from "element-plus";

export default defineComponent({
  props: {
    modelValue: {
      type: Object as PropType<VisualEditorModelValue>,
      required: true,
    },
    config: {
      type: Object as PropType<VisualEditorConfig>,
      required: true,
    },
  },
  emits: {
    "update:modelValue": (val?: VisualEditorModelValue) => true,
  },
  setup(props, { emit }) {
    // 双向绑定至容器中的组件数据
    const dataModel = useModel(() => props.modelValue, val => emit("update:modelValue", val));
    // container节点dom对象的引用
    const containerRef = ref({} as HTMLDivElement);
    // container节点的样式对象
    const containerStyles = computed(() => ({
      width: `${dataModel.value.container.width}px`,
      height: `${dataModel.value.container.height}px`,
    }));
    // 计算选中与未选中的block数据
    const focusData = computed(() => {
      const focus: VisualEditorBlockData[] = [];
      const unFocus: VisualEditorBlockData[] = [];
      dataModel.value.blocks?.forEach(block => (block.focus ? focus : unFocus).push(block));
      return {
        focus,    // 此时选中的数据
        unFocus,  // 此时未选中的数据
      };
    });

    const dragstart = createEvent();
    const dragend = createEvent();

    // 对外暴露的一些方法
    const methods = {
      clearFocus: (block?: VisualEditorBlockData) => {
        let blocks = dataModel.value.blocks || [];
        if (blocks.length === 0) return;
        if (block) {
          blocks = blocks.filter(item => item !== block);
        }

        blocks.forEach(block => block.focus = false);
      },
      updateBlocks: (blocks?: VisualEditorBlockData[]) => {
        dataModel.value = { ...dataModel.value, blocks };
      },
    };
    // 处理从菜单拖拽组件到容器的相关动作
    const menuDragger = (() => {
      let component = null as null | VisualEditorComponent;

      const blockHandler = {
        // 处理拖拽菜单组件开始动作
        dragstart: (e: DragEvent, current: VisualEditorComponent) => {
          containerRef.value.addEventListener("dragenter", containerHandler.dragenter);
          containerRef.value.addEventListener("dragover", containerHandler.dragover);
          containerRef.value.addEventListener("dragleave", containerHandler.dragleave);
          containerRef.value.addEventListener("drop", containerHandler.drop);
          dragstart.emit();
          component = current;
        },
        // 处理拖拽菜单组件结束动作
        dragend: () => {
          containerRef.value.removeEventListener("dragenter", containerHandler.dragenter);
          containerRef.value.removeEventListener("dragover", containerHandler.dragover);
          containerRef.value.removeEventListener("dragleave", containerHandler.dragleave);
          containerRef.value.removeEventListener("drop", containerHandler.drop);
          component = null;
        },
      };
      const containerHandler = {
        // 拖拽菜单组件，进入容器的时候，设置鼠标的可放置状态
        dragenter: (e: DragEvent) => e.dataTransfer!.dropEffect = "move",
        // 如果拖拽过程中，鼠标离开了容器，设置鼠标为不可放置的状态
        dragleave: (e: DragEvent) => e.dataTransfer!.dropEffect = "none",
        // 拖拽菜单组件，鼠标在容器中移动的时候，禁用默认事件
        dragover: (e: DragEvent) => e.preventDefault(),
        // 在容器中放置的时候，通过事件对象的 offsetX 和 offsetY 添加一条组件数据
        drop: (e: DragEvent) => {
          const blocks = [...dataModel.value.blocks || []];
          blocks.push(
            createNewBlock({ component: component!, top: e.offsetY, left: e.offsetX }),
          );
          methods.updateBlocks(blocks);
          dragend.emit();
        },
      };
      return blockHandler;
    })();
    // 处理block选中的相关动作
    const focusHandler = (() => {
      return {
        container: {
          onMousedown: (e: MouseEvent) => {
            e.preventDefault();
            // 只处理容器的事件
            if (e.currentTarget !== e.target) return;

            // 点击空白处，清空所有选中的bloack
            if (!e.shiftKey) {
              methods.clearFocus();
            }
          },
        },
        block: {
          onMousedown: (e: MouseEvent, block: VisualEditorBlockData) => {
            // 按住了 shift 键
            if (e.shiftKey) {
              // 如果此时没有选中的 block，就选中这个 block，否则让这个 block 的选中状态取反
              if (focusData.value.focus.length <= 1) {
                block.focus = true;
              } else {
                block.focus = !block.focus;
              }
            } else {
              // 如果当前这个block没有选中，那么将其选中，并且清除其他的block
              if (!block.focus) {
                block.focus = true;
                methods.clearFocus(block);
              }
            }
            blockDragger.mousedown(e);
          },
        },
      };
    })();
    // 处理block在container中拖拽移动的相关动作
    const blockDragger = (() => {
      let dragState = {
        startX: 0,
        startY: 0,
        startPos: [] as { left: number; top: number }[],
        dragging: false,
      };
      const mousedown = (e: MouseEvent) => {
        dragState = {
          startX: e.clientX,
          startY: e.clientY,
          startPos: focusData.value.focus.map(({ top, left }) => ({ top, left })),  // 每个激活元素的top、left初始值
          dragging: false,
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", mouseup);
      };

      const mousemove = (e: MouseEvent) => {
        const durX = e.clientX - dragState.startX;
        const durY = e.clientY - dragState.startY;
        if (!dragState.dragging) {
          dragState.dragging = true;
          dragstart.emit();
        }
        focusData.value.focus.forEach((block, index) => {
          block.top = dragState.startPos[index].top + durY;
          block.left = dragState.startPos[index].left + durX;
        });
      };

      const mouseup = () => {
        document.removeEventListener("mousemove", mousemove);
        document.removeEventListener("mouseup", mouseup);
        if (dragState.dragging === true) {
          dragend.emit();
        }
      };

      return { mousedown };
    })();

    const commander = useVisualCommand({
      focusData,
      updateBlocks: methods.updateBlocks,
      dataModel,
      dragstart,
      dragend,
    });

    const buttons = [
      { label: "撤销", icon: "icon-back", handler: commander.undo, tip: "ctrl+z" },
      { label: "重做", icon: "icon-forward", handler: commander.redo, tip: "ctrl+y, ctrl+shift+z" },
      {
        label: "导入",
        icon: "icon-import",
        handler: async() => {
          const text = await $$dialog.textarea("", "请输入导入的JSON字符串");
          if (!text) return;
          try {
            const data = JSON.parse(text || "");
            dataModel.value = data;
          } catch (e) {
            ElNotification({ title: "导入失败", message: "导入的数据格式不正常，请检查" });
          }
        },
      },
      {
        label: "导出",
        icon: "icon-export",
        handler: () => $$dialog.textarea(JSON.stringify(dataModel.value), "导出的JSON数据", { editReadonly: true }),
      },
      { label: "置顶", icon: "icon-place-top", handler: () => commander.placeTop(), tip: "ctrl+up" },
      { label: "置底", icon: "icon-place-bottom", handler: () => commander.placeBottom(), tip: "ctrl+down" },
      { label: "删除", icon: "icon-delete", handler: () => commander.delete(), tip: "ctrl+d, backspace, delete" },
      { label: "清空", icon: "icon-reset", handler: () => commander.clear() },
    ];

    return () => <div class="visual-editor">
      <div class="visual-editor-menu">
        {props.config.componentList.map(component => (
          <div class="visual-editor-menu-item"
            draggable
            onDragstart={(e) => menuDragger.dragstart(e, component)}
            onDragend={menuDragger.dragend}
          >
            <span class="visual-editor-menu-item-label">{component.label}</span>
            {component.preview()}
          </div>
        ))}
      </div>
      <div class="visual-editor-head">
        {buttons.map((btn, index) => {
          const content = <div key={index} onClick={btn.handler} class="visual-editor-head-button">
            <i class={`iconfont ${btn.icon}`}></i>
            <span>{btn.label}</span>
          </div>;
          return !btn.tip
            ? content
            : <el-tooltip effect="dark" content={btn.tip} placement="bottom">
              {content}
            </el-tooltip>;
        })}
      </div>
      <div class="visual-editor-operator">
      visual-editor-operator
      </div>
      <div class="visual-editor-body">
        <div class="visual-editor-content">
          <div class="visual-editor-container"
            style={containerStyles.value}
            ref={containerRef}
            {...focusHandler.container}
          >
            {!!dataModel.value && !!dataModel.value.blocks && (
              dataModel.value.blocks.map((block, index) => (
                <VisualEditorBlock
                  config={props.config}
                  block={block}
                  key={index}
                  {...{
                    onMousedown: (e: MouseEvent) => focusHandler.block.onMousedown(e, block),
                  }}
                />
              ))
            )}
          </div>

        </div>
      </div>
    </div>;
  },
});
