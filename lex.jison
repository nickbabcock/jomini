
/* description: Parses and executes mathematical expressions. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
"yes"\b               return 'BOOL'
"no"\b                return 'BOOL'
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
(\d+)"."(\d+)"."(\d+)\b return 'DATE'
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
        { typeof console !== 'undefined' ? console.log($1) : print($1);
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
    ;

PValue
    : NUMBER
        {$$ = +yytext;}
    | BOOL
        {$$ = yytext === 'yes';}
    | IDENTIFIER
        {$$ = yytext;}
    ;

