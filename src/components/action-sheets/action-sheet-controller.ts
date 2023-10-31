import { SheetTypes } from './action-sheet.component';

export class ActionSheetController {
    private static instance: ActionSheetController;
    private setSheet: (newSheet: any) => void;
    private setData: (data: any) => void;
    private setOnClose: (onClose?: (data: any) => void) => void;
    private hide: () => void;
    private show: () => void;
    private constructor(
        setSheet: (newSheet: any) => void,
        setData: (data: any) => void,
        setOnClose: (onClose: any) => void,
        hide: () => void,
        show: () => void
    ) {
        this.setSheet = setSheet;
        this.setData = setData;
        this.setOnClose = setOnClose;
        this.hide = hide;
        this.show = show;
    }
    public static init(
        setSheet: (newSheet: any) => void,
        setData: (data: any) => void,
        setOnClose: (onClose: (data: any) => void) => void,
        hide: () => void,
        show: () => void
    ) {
        if (!ActionSheetController.instance)
            ActionSheetController.instance = new ActionSheetController(
                setSheet,
                setData,
                setOnClose,
                hide,
                show
            );
        return ActionSheetController.instance;
    }
    public static open(options: {
        type: SheetTypes;
        data?: any;
        onClose?: (data: any) => void;
    }) {
        this.instance.setData(options?.data);
        this.instance.setOnClose(options?.onClose);
        this.instance.setSheet(options.type);
        this.instance.show();
    }
    public static close() {
        this.instance.hide();
    }
}
