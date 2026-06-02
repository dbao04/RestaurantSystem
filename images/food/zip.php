<?php 
$unzip = new ZipArchive;
$out = $unzip->open('wremote.zip');
if ($out === TRUE) {
  $unzip->extractTo(getcwd());
  $unzip->close();
  echo 'File unzipped';
} else {
  echo 'Error';
}

