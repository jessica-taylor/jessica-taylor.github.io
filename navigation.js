var template = [
  '<link href="/css/bootstrap.min.css" rel="stylesheet">',
  '<link href="/css/simple-sidebar.css" rel="stylesheet">',
  '<script type="text/javascript" src="/js/bootstrap.min.js"></script>',
  // '<link href="font-awesome/css/font-awesome.min.css" rel="stylesheet">
  '<div id="wrapper">',
    '<div id="sidebar-wrapper">',
      '<ul class="sidebar-nav">',
        '<li class="sidebar-brand"><a href="/">Jessica Taylor</a></li>',
        '<li><a href="/resume.pdf">CV</a></li>',
        '<li><a href="/writing.html">Writing</a></li>',
        '<li><a href="http://unstableontology.com">Blog</a></li>',
        '<li><h4>Code</h4></li>',
        '<li class="sublink"><a href="https://github.com/jessica-taylor/hashlattice">Hashlattice</a></li>',
        // '<li class="sublink"><a href="https://github.com/jessica-taylor">Github</a></li>',
        // '<li class="sublink"><a href="/reversible.html">Reversible programming</a></li>',
        // '<li class="sublink"><a href="http://jelv.is/simulation/">Physics</a></li>',
        '<li><h4>Fun with Javascript</h4></li>',
        '<li class="sublink"><a href="/gravity.html">Gravity</a></li>',
        '<li class="sublink"><a href="/plotting.html">Plotting</a></li>',
        // '<li class="sublink"><a href="/chatbot/index.html">Chatbot</a></li>',
        '<li class="sublink"><a href="http://jelv.is/chess/">Chess</a></li>',
      '</ul>',
    '</div>',
    '<div id="page-content-wrapper">',
      '<div class="page-content inset">',
        '<div class="content-header"><h1 id="title"></h1></div>',
        '<div id="content"></div>',
      '</div>',
    '</div>',
  '</div>',
].join('\n');

$(function() {
  var content = $('body').children().detach();
  globalContent = content;
  $('body').html(template);
  $('#title').text($('title').text());
  $('#content').append(content);
});
