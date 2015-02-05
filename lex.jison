%{
var toDate = require('./').toDate;
%}

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
"yes"\b               return 'BOOL'
"no"\b                return 'BOOL'
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
[0-9.]+\b return 'DATE'
"{"                   return '{'
"}"                   return '}'
"="                   return '='
'"'                   return '"'
"#"                   return "#"
[a-zA-Z0-9]+          return 'IDENTIFIER'
.                     return 'INVALID'
<<EOF>>               return 'EOF'


/lex

%start expressions

%% /* language grammar */

expressions
    : PMemberList EOF
        { typeof console !== 'undefined' ? console.log(obj) : print(obj);
          return $1; }
    ;

PObject
    : { }
    | { PMemberList }
    ;

PMemberList
    : PMember
    | PMemberList PMember
    ;

PMember 
    : IDENTIFIER '=' PValue
        {obj[$1] = $3;}
    ;

PElements
    : '{' PList '}'
    ;

PList
    : PValue
    | PList PValue
    ;

PValue
    : NUMBER
        {$$ = +yytext;}
    | BOOL
        {$$ = yytext === 'yes';}
    | '"' IDENTIFIER '"'
        {$$ = $2;}
    | IDENTIFIER
        {$$ = yytext;}
    | DATE
        {$$ = toDate(yytext);}

/*    | PElements
        {$$ = $2;}*/
//    | PObject
    ;

%%

obj = {};

