import { SheetTypes } from './action-sheet.component';

export class ActionSheetController {
    private static instance: ActionSheetController;
    private setSheet: (newSheet: any) => void;
    private setData: (data: any) => void;
    private setOnSubmit: (onClose?: (data: any) => void) => void;
    private setOnDismiss: (onClose?: () => void) => void;
    private hide: () => void;
    private show: () => void;
    private constructor(
        setSheet: (newSheet: any) => void,
        setData: (data: any) => void,
        setOnSubmit: (onClose: any) => void,
        setOnDismiss: (onClose: any) => void,
        hide: () => void,
        show: () => void
    ) {
        this.setSheet = setSheet;
        this.setData = setData;
        this.setOnSubmit = setOnSubmit;
        this.setOnDismiss = setOnDismiss;
        this.hide = hide;
        this.show = show;
    }
    public static init(
        setSheet: (newSheet: any) => void,
        setData: (data: any) => void,
        setOnSubmit: (onClose: (data: any) => void) => void,
        setOnDismiss: (onClose: () => void) => void,
        hide: () => void,
        show: () => void
    ) {
        if (!ActionSheetController.instance)
            ActionSheetController.instance = new ActionSheetController(
                setSheet,
                setData,
                setOnSubmit,
                setOnDismiss,
                hide,
                show
            );
        return ActionSheetController.instance;
    }
    public static open(options: {
        type: SheetTypes;
        data?: any;
        onSubmit?: (data: any) => void;
        onDismiss?: () => void;
    }) {
        this.instance.setData(options?.data);
        this.instance.setOnSubmit(options?.onSubmit);
        this.instance.setOnDismiss(options?.onDismiss);
        this.instance.setSheet(options.type);
        this.instance.show();
    }
    public static close() {
        this.instance.hide();
    }
}
