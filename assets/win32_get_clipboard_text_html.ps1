
#add-type -an system.windows.forms
[System.Console]::OutputEncoding = [System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$path = Split-Path -Parent $MyInvocation.MyCommand.Definition
$result = &"$path/win32/winclip.exe"  49383  | ConvertFrom-Json

$html = $result.data 
$html

#$content = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html)
#$bytes = [System.Text.Encoding]::Default.GetBytes($content)
#$content = [System.Text.Encoding]::UTF8.GetString($bytes)
#[Console]::WriteLine($content)