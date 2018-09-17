import { Component, AfterViewInit, Input } from '@angular/core';
import { NavigationTree, NavInfo, NavChild } from '../Data Structures/NavigationTree';
import { Utility } from '../Utility';
import { QueryEditorComponent } from '../query-editor/query-editor.component';
import { TabManagerComponent } from '../tab-manager/tab-manager.component';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements AfterViewInit {
    static readonly imgPrefix: string = '<img style="width:30px;height:auto;margin-right:10px;" src="';
    static readonly imgSuffix = '" draggable="false"/>';

    static activeColor: string = "#ffffff";
    static inactiveColor: string = "#526b78";
    static activebackground: string = "#0056b7";
    static inactivebackground: string = "#fff";

    @Input() tabManager: TabManagerComponent;

    navTree: NavigationTree;
    currentNavInfo: NavInfo;
    navigationEnabled: boolean;
    refreshEnabled: boolean;

    /**
     * Map from navTree database roots to depth-based icon hierarchy.
     */
    iconDepthMap: Map<string, string[]>;
    /**
     * Map from navTree file-storage roots to icon hierarchy
     */
    fileStorageMap: Map<string, string[]>;
    /**
     * Map from readable child extensions to icons
     */
    readableChildMap: Map<string, string>;
    /**
     * Map from non-readable child extensions to icons
     */
    nonReadableChildMap: Map<string, string>;

    ngAfterViewInit() {
        // JQuery Ready function for side navigation toggle 
        $('.navbar-toggler').click(function () {
            if ($(this).hasClass('sidebar-toggler')) {
                $('body').toggleClass('sidebar-hidden');
            }
            if ($(this).hasClass('sidebar-minimizer')) {
                $('body').toggleClass('sidebar-minimized');
            }
            if ($(this).hasClass('aside-menu-toggler')) {
                $('body').toggleClass('aside-menu-hidden');
            }
            if ($(this).hasClass('mobile-sidebar-toggler')) {
                $('body').toggleClass('sidebar-mobile-show');
            }
        });

        $('.sidebar-close').click(function () {
            $('body').toggleClass('sidebar-opened').parent().toggleClass('sidebar-opened');
        });

        this.navTree = new NavigationTree("http://52.22.85.175:5000/databases?path=");

        this.displayLoadingMessage();
        this.handleNavigation(this.navTree.refresh());
        $("#nav-context-menu").hide();
    }

    constructor() {
        this.iconDepthMap = new Map<string, string[]>();
        this.iconDepthMap.set("MYSQL",
            ["assets/image/mysql.png", "fa-database", "fa-table", ""]
        );
        this.iconDepthMap.set("POSTGRESQL",
            ["assets/image/postgres.png", "fa-database", "fa-cubes", "fa-table", ""]
        );
        this.fileStorageMap = new Map<string, string[]>();
        this.fileStorageMap.set("S3",
            ["assets/image/bucket.png", "assets/image/folder.png"]
        );
        this.fileStorageMap.set("Files",
            ["assets/image/folder.png"]
        );

        this.readableChildMap =
            Utility.setMap(["csv", "xlsx", "parquet", "json"],
                ["assets/image/csv-2.png", "assets/image/excel.png", "assets/image/parquet.png", "assets/image/106842.png"]
            );

        this.nonReadableChildMap =
            Utility.setMap(["txt"],
                ["assets/image/text.png"]
            );
    }

    /**
     * Handler for navigation promises.
     * @param promise 
     */
    private handleNavigation(promise: Promise<NavInfo>) {
        promise.then(
            (navInfo) => this.displayNavBrowser(navInfo),
            () => this.displayLoadFailure()
        )
        $("#nav-search").val('');
    }

    /**
     * Display a loading message and disable navigation.
     */
    private displayLoadingMessage() {
        this.disableNavigation();
        $("#nav-message").text("Loading...");
        this.showMessage();
    }

    /**
     * Display a load failure message and enable the refresh button.
     */
    private displayLoadFailure() {
        $("#nav-message").text("Network connection failure.  Please try again later.");
        this.enableRefresh();
    }

    /**
     * Disable all forms of navigation.
     */
    private disableNavigation() {
        this.navigationEnabled = false;
        this.refreshEnabled = false;
        $("#nav-back").css({ cursor: "default", color: NavbarComponent.inactiveColor, background: NavbarComponent.inactivebackground })
        $("#nav-forward").css({ cursor: "default", color: NavbarComponent.inactiveColor, background: NavbarComponent.inactivebackground })
        $("#nav-refresh").css({ cursor: "default", color: NavbarComponent.inactiveColor, background: NavbarComponent.inactivebackground })
    }

    /**
     * Show the currently loaded message while hiding the nav browser
     */
    private showMessage() {
        $("#nav-name").html("&nbsp;");
        $("#nav-message").show();
        $("#nav-browser").hide();
    }

    /**
     * Show the nav browser while hiding the currently loaded message
     */
    private showBrowser() {
        $("#nav-message").hide();
        $("#nav-browser").show();
    }

    /**
     * Enable all forms of navigation possible.
     */
    private enableNavigation() {
        this.navigationEnabled = true;

        this.enableBack();
        this.enableForward();
        this.enableRefresh();
    }

    /**
     * Enable the back button, if possible.
     */
    private enableBack() {
        if (this.navTree.canGoBack()) {
            $("#nav-back").css({ cursor: "pointer", color: NavbarComponent.activeColor, background: NavbarComponent.activebackground })
        }
    }

    /**
     * Enable the forward button, if possible.
     */
    private enableForward() {
        if (this.navTree.canGoForward()) {
            $("#nav-forward").css({ cursor: "pointer", color: NavbarComponent.activeColor, background: NavbarComponent.activebackground })
        }
    }

    /**
     * Enable refreshing
     */
    private enableRefresh() {
        $("#nav-refresh").css({ cursor: "pointer", color: NavbarComponent.activeColor, background: NavbarComponent.activebackground })
        this.refreshEnabled = true;
    }

    /**
     * Draw the given NavInfo to the navbar.
     * @param navInfo 
     */
    private displayNavBrowser(navInfo: NavInfo) {
        this.currentNavInfo = navInfo;
        // If we're at the root, let this directory name be the empty string
        $("#nav-name").contents().remove();
        if (navInfo.name != "root") {
            $("#nav-name").text(navInfo.name);
            let isReadableChild = navInfo.isReadableChild;
            $("#nav-name").prepend(this.getPathIcon(this.navTree.path, !isReadableChild, isReadableChild, false))
        } else {
            $("#nav-name").html("&nbsp;");
        }
        $("#nav-browser > li").remove();

        // Show a message if this directory is empty, otherwise display a new nav browser.
        if (navInfo.children.length == 0) {
            $("#nav-message").text("This directory is empty.");
            this.showMessage();
        } else {
            navInfo.children.forEach(child => {
                let icon =
                    this.getPathIcon(this.navTree.buildPath(child.name), child.hasChildren, child.isReadableChild, navInfo.isReadableChild);

                let text = child.type.length > 0 ? child.name + " " + child.type : child.name;
                let childText = $("<span>" + text + "</span>");

                $("#nav-browser").append(
                    $("<li class=\"nav-child\">" + icon + "</li>").append(childText)
                );

                // Add draggability to child.
                this.makeDraggable(childText, child);
            });
            this.showBrowser();
        }

        this.enableNavigation();
    }

    /**
     * Make the given element draggable, with its payload filled out using information from the
     * given NavChild.
     * @param element 
     * @param child 
     */
    private makeDraggable(element: JQuery<HTMLElement>, child: NavChild) {
        (element as any).draggable({
            helper: () => {
                let payload = child.hasChildren || child.isReadableChild ? this.formatPathToEditor(child.name) : Utility.escape(child.name);
                let clone = ($("<div></div>").append(payload).clone());
                clone.addClass("navDrag");
                clone.css({ display: "inline-block" });
                return clone;
            },
            drag: function (event, ui) {
                if ($(this).data("drag-action")) {
                    $(this).data("drag-action")(event);
                }
            },
            cursor: "default",
            cursorAt: { top: 5, left: 0 },
            opacity: 0.8,
            containment: $("#federation"),
            appendTo: $("#federation")
        });
    }

    /**
     * Format the given text to be ready for the editor.
     * @param text 
     */
    private formatPathToEditor(text: string) {
        if (this.navTree.path == "") {
            return Utility.escape(text);
        }
        let splitPath = this.navTree.buildPath(text).split('/');

        // Wrap each token in the path in square brackets.
        for (let i = 0; i < splitPath.length; i++) {
            splitPath[i] = Utility.escape(splitPath[i].trim());
        }

        return splitPath.join('.');
    }

    /**
     * Wrap a path to an asset in the HTML NavbarComponents use to draw images.
     * @param internalValue 
     */
    public wrapNavImage(internalValue: string) {
        return NavbarComponent.imgPrefix + internalValue + NavbarComponent.imgSuffix;
    }

    /**
     * Style the Navigation tree with respective icons
     */
    public getPathIcon(path: string, hasChildren: boolean, isReadableChild: boolean, parentIsReadableChild: boolean): string {

        let splitpath = path.split('/');
        let root = splitpath[0];
        splitpath = splitpath.slice(1)
        if (this.iconDepthMap.has(root)) {
            if (splitpath.length == 0) {
                return this.wrapNavImage(this.iconDepthMap.get(root)[0]);
            } else {
                return '<i style="margin-right:10px;" class="fa ' + this.iconDepthMap.get(root)[splitpath.length] + '"></i>';
            }
        }
        if (root == "S3") {
            var fileimg = path.split('.');
            let extension = fileimg[fileimg.length - 1];
            if (splitpath.length == 0) {
                return this.wrapNavImage(this.fileStorageMap.get(root)[0]);
            }
            if (hasChildren) {
                return this.wrapNavImage(this.fileStorageMap.get(root)[1]);
            }
            if (isReadableChild && this.readableChildMap.has(extension)) {
                return this.wrapNavImage(this.readableChildMap.get(extension));
            } else if (this.nonReadableChildMap.has(extension)) {
                return this.wrapNavImage(this.nonReadableChildMap.get(extension));
            }
        }

        if (root == "Files") {
            var fileimg = path.split('.');
            let extension = fileimg[fileimg.length - 1];
            if (hasChildren) {
                return this.wrapNavImage(this.fileStorageMap.get(root)[0]);
            }
            if (isReadableChild && this.readableChildMap.has(extension)) {
                return this.wrapNavImage(this.readableChildMap.get(extension));
            } else if (this.nonReadableChildMap.has(extension)) {
                return this.wrapNavImage(this.nonReadableChildMap.get(extension));
            }
        }

        if (!parentIsReadableChild) {
            return this.wrapNavImage("assets/image/defaultFile.png");
        }
        return "";
    }

    /**
     * Navigate downwards the tree towards the latest child of the current directory 
     * to be set as active.
     */
    public navigateForward() {
        if (!this.navigationEnabled || !this.navTree.canGoForward()) { return; }
        this.displayLoadingMessage();
        this.handleNavigation(this.navTree.forward());
    }

    /**
     * Navigate backwards up the tree, putting the active directory at the current
     * node's parent.
     */
    public navigateBack() {
        if (!this.navigationEnabled || !this.navTree.canGoBack()) { return; }

        this.displayLoadingMessage();
        this.handleNavigation(this.navTree.back());
    }

    /**
     * Refresh the current directory of the navigation tree.
     */
    public refresh() {
        if (!this.refreshEnabled) { return; }
        this.displayLoadingMessage();
        this.handleNavigation(this.navTree.refresh());
    }

    /**
     * If the child at the given index is not a leaf, navigate down the tree to its
     * directory.  Otherwise, use it for a context-sensitive action.
     * @param index 
     */
    public navigateOnChild(index: number) {
        let child: NavChild = this.currentNavInfo.children[index];
        if (child.hasChildren || child.isReadableChild) {
            this.displayLoadingMessage();
            this.handleNavigation(this.navTree.navigateChild(child.name));
        }
    }

    /**
     * Place the selected child to the editor.  Does nothing if the selected element is not a leaf.
     * @param index 
     */
    public placeChild(index: number) {
        let child: NavChild = this.currentNavInfo.children[index];
        if (!child.hasChildren && !child.isReadableChild) {
            let fed = this.tabManager.getActiveComponent();
            if (fed) {
                fed.editor.replaceSelectedRegionFromExternal(Utility.escape(child.name));
            }
        }
    }

    /**
     * Search the current listing for the given query
     * @param query 
     */
    public search(query: string) {
        query = query.toLowerCase();
        $("#nav-browser").children().each((index, element) => {
            let qIndex = element.textContent.toLowerCase().indexOf(query);
            if (qIndex >= 0) {
                this.highlightSearch($(element), qIndex, query);
            } else {
                $(element).hide();
            }
        });
    }

    /**
     * Highlight the substring matching the given query, starting at qIndex.
     * @param element 
     * @param qIndex 
     * @param query 
     */
    private highlightSearch(element: JQuery<HTMLElement>, qIndex: number, query: string) {
        let textElement = element.children("span");
        let textContent = textElement.text();
        textElement.contents().remove();
        if (query.length > 0) {
            textElement.append(
                document.createTextNode(textContent.substring(0, qIndex))
            );
            textElement.append(
                '<span class="search-sel">' + textContent.substring(qIndex, qIndex + query.length) + '</span>'
            )
            textElement.append(
                document.createTextNode(textContent.substring(qIndex + query.length))
            );
        } else {
            textElement.text(textContent);
        }
        element.show();
    }

    /**
     * Draw the context menu for the item at the given index.
     * If the item does not have a valid menu, do nothing instead.
     * @param index 
     * @param e 
     */
    public drawContextMenu(index: number, e) {
        let child: NavChild = this.currentNavInfo.children[index];
        if (!child.hasChildren && !child.isReadableChild) {
            return;
        }
        $("#nav-context-menu").hide(100);
        $("#nav-context-menu").contents().remove();
        $("<li>Create SELECT Query</li>").appendTo($("#nav-context-menu")).on("click", () => {
            let fed = this.tabManager.getActiveComponent();
            if (fed) {
                fed.editor.replaceSelectedRegionFromExternal("SELECT * FROM " + this.formatPathToEditor(child.name));
            }
        }
        );

        $("#nav-context-menu").css({
            top: e.pageY - $(".sidebar").offset().top + "px",
            left: e.pageX - $(".sidebar").offset().left + "px"
        });

        $("#nav-context-menu").finish().show(100);
    }
}
