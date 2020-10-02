const FILE_IN = document.getElementById("fileImport");
const TARGET = document.getElementById("importTarget");

function copyTree(jsonArr) {
    var tree = document.createElement("ul");
    // tree.className = "subnodeslist";
    jsonArr.forEach(t => {
        var cont = document.createElement("li");
        let title = document.createElement("span");
        let link = document.createElement("a");
        cont.id = "savedtabundefined";
        cont.className = "nodeTitleAndSubnodesContainer savedtabNTASC NTASC-tabFrame";
        link.className = "nodeTitleContainer savedtabNTC";
        link.href = t.url;
        title.className = "node_text";
        title.innerHTML = t.title;
        link.appendChild(title);
        cont.appendChild(link);
        tree.appendChild(cont);
    });
    return tree.innerHTML;
}

function loadFile(e) {
    if (e.clipboardData) {
        TARGET.innerHTML = copyTree(JSON.parse(e.clipboardData.getData('text')));
    }
    else {
        let files;
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            files = e.dataTransfer.files;
        }
        else if (e.target && e.target.files.length > 0) {
            files = e.target.files;
        }
        files[0].text().then(txt => TARGET.innerHTML = copyTree(JSON.parse(txt)));        
    }
}

FILE_IN.addEventListener("change", loadFile);
document.addEventListener("drop", loadFile, true);
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("paste", loadFile, true);