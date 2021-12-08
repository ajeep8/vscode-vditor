add-type -an system.windows.forms
$content = [System.Windows.Forms.Clipboard]::GetText()
[System.Console]::OutputEncoding = [System.Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::WriteLine($content)
