export interface NavInfo {
    name: string,
    children: NavChild[],
    isReadableChild: boolean
}

export interface NavChild {
    name: string,
    hasChildren: boolean,
    isReadableChild: boolean,
    type: string
}

/**
 * Tree structure that models the navigation structure via network requests.
 */
export class NavigationTree {
    path: string;
    name: string;
    rootPath: string;
    children: NavChild[];
    backHistory: string[];
    forwardHistory: string[];

    public constructor(rootPath: string) {
        this.rootPath = rootPath
        this.path = "";
        this.name = "";
        this.children = [];
        this.backHistory = [];
        this.forwardHistory = [];
    }

    /**
     * Refresh the currently loaded NavigationTree.
     */
    public refresh(): Promise<NavInfo> {
        return this.navigate(this.path);
    }

    /**
     * Navigate directly to the given path.
     * @param path 
     */
    public navigate(path: string): Promise<NavInfo> {
        return (function(t) {
            let promise: Promise<NavInfo> = new Promise(function(resolve, reject) {
                var request = new XMLHttpRequest();
                request.onreadystatechange = (function(t) {
                    return function() {
                        if (this.readyState == 4) {
                            if(this.status == 200) {
                                let response = JSON.parse(request.responseText);
                                t.name = response.name;
                                t.children = []
                                response.children.forEach(child => {
                                    t.children.push({
                                        name: child.name,
                                        hasChildren: child.has_children,
                                        isReadableChild: child.is_readable_child,
                                        type: child.type
                                    })
                                });
                                t.path = path;

                                resolve({
                                    name: t.name,
                                    children: t.children,
                                    isReadableChild: response.is_readable_child
                                });
                            } else {
                                reject()
                            }
                        }
                    }
                  })(t);

                request.open('GET', t.rootPath + path);
                request.send();
            });
            return promise;
        })(this);
    }

    /**
     * Navigate the tree down, towards the given child.
     * @param child 
     */
    public navigateChild(child: string): Promise<NavInfo> {
        this.backHistory.push(this.name);
        this.forwardHistory = [];
        return this.navigate(this.buildPath(child));
    }

    /**
     * Navigate back up the tree using this tree's history.
     */
    public back(): Promise<NavInfo> {
        this.forwardHistory.push(this.name);
        this.backHistory.pop();
        return this.navigate(
            this.path.substring(
                0,
                this.path.lastIndexOf('/')
            )
        );
    }

    /**
     * Check if this tree has any history to go back on.
     */
    public canGoBack(): boolean {
        return this.backHistory.length > 0;
    }

    /**
     * Navigate forwards using this tree's history.
     */
    public forward(): Promise<NavInfo> {
        this.backHistory.push(this.name);
        let next = this.forwardHistory.pop();
        return this.navigate(this.buildPath(next));
    }

    /**
     * Check if this tree has any history to go forward on.
     */
    public canGoForward(): boolean {
        if(this.forwardHistory.length > 0) {
            // In the event that a refresh removed the next element in the forward history, clear forward history.

            let lIndex = this.forwardHistory.length - 1;
            if (!this.children.some(e => (e.name === this.forwardHistory[lIndex] && e.hasChildren))) {
                this.forwardHistory = [];
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Check if this navigation tree is currently positioned at the root.
     */
    public isAtRoot(): boolean {
        return this.path.length == 0;
    }

    /**
     * Given a string as input, return a new path that will follow the format that this tree uses,
     * while using the current path of this as the base.
     */
    public buildPath(child: string, delimiter: string='/'): string {
        return this.path.length == 0 ? child : this.path + delimiter + child;
    }
}