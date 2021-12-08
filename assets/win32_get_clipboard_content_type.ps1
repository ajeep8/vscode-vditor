add-type -an system.windows.forms
[System.Console]::OutputEncoding = [System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$dataObj = [System.Windows.Forms.Clipboard]::GetDataObject();

if ($dataObj) {
    foreach ($fmt in $dataObj.GetFormats()) {
        [Console]::WriteLine($fmt)
    }
}

[Console]::WriteLine($content)
