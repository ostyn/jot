export class ActionSheetController {
    private static instance: ActionSheetController;
    private setSheet: (newSheet: any) => void;
    private setData: (data: any) => void;
    private setOnClose: (onClose: any) => void;
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
        setOnClose: (onClose: any) => void,
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
    public static open(type, data = null, onClose = null) {
        this.instance.setData(data);
        this.instance.setOnClose(onClose);
        this.instance.setSheet(type);
        this.instance.show();
    }
    public static close() {
        this.instance.hide();
    }
}
