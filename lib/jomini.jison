%{
var toDate = require('./toDate');
var setProp = require('./setProp');
%}

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
"yes"\b               return 'BOOL'
"no"\b                return 'BOOL'
[0-9]+"."[0-9]+"."[0-9]+(?=$|[ \t\r\n\{\}\=\!\>\<]) return 'DATE'
'"'[0-9]+"."[0-9]+"."[0-9]+'"' yytext = yytext.substr(1,yyleng-2); return 'QDATE'
"-"?[0-9]+("."[0-9]+)?(?=$|[ \t\r\n\{\}\=\!\>\<])  return 'NUMBER'
"{"                   return '{'
"}"                   return '}'
"hsv"                 return 'hsv'
"rgb"                 return 'rgb'
"<="                  return '<='
">="                  return '>='
"="                   return '='
"<"                   return '<'
">"                   return '>'
"\\\""                return '"'
\"[^\"\\]*(?:\\.[^\"\\]*)*\" yytext = yytext.substr(1,yyleng-2).replace(/\\\"/g, '"'); return 'QIDENTIFIER'
[a-zA-Z0-9\-_\.:@]+   return 'IDENTIFIER'
"#"[^\r\n]*((\r\n)|<<EOF>>)       /* skip comments */
.                     return 'INVALID'
<<EOF>>               return 'EOF'


/lex

%start expressions

%% /* language grammar */

expressions
    : PMemberList EOF
        { return obj; }
    | IDENTIFIER PMemberList EOF
        { return obj; }
    ;

PMemberList
    : PMember
        {if(key) {nest.push(obj); obj = {}; setProp(obj, key, value);}}
    | PMemberList PMember
        {if (key) {setProp(obj, key, value);}}
    ;

PMember
    : IDENTIFIER '=' PValue
        {key = $1; value = $3;}
    | QIDENTIFIER '=' PValue
        {key = $1; value = $3;}
    | '=' '=' PValue
        {key = $1; value = $3;}
    | NUMBER '=' PValue
        {key = $1; value = $3;}
    | DATE '=' PValue
        {key = $1; value = $3;}
    | DATE '=' '{' '}'
        {key = $1; value = {};}
    | IDENTIFIER '=' '{' '}'
        {key = $1; value = {};}
    | '{' '}'
        {key = undefined;}

    | IDENTIFIER '<' PValue
        {key = $1; value = {'LESS_THAN': $3};}
    | QIDENTIFIER '<' PValue
        {key = $1; value = {'LESS_THAN': $3};}

    | IDENTIFIER '<=' PValue
        {key = $1; value = {'LESS_THAN_EQUAL': $3};}
    | QIDENTIFIER '<=' PValue
        {key = $1; value = {'LESS_THAN_EQUAL': $3};}

    | IDENTIFIER '>' PValue
        {key = $1; value = {'GREATER_THAN': $3};}
    | QIDENTIFIER '>' PValue
        {key = $1; value = {'GREATER_THAN': $3};}

    | IDENTIFIER '>=' PValue
        {key = $1; value = {'GREATER_THAN_EQUAL': $3};}
    | QIDENTIFIER '>=' PValue
        {key = $1; value = {'GREATER_THAN_EQUAL': $3};}
    ;

PList
    : PValue
        {nest.push(obj); obj = [$1];}
    | PList PValue
        {obj.push($2);}
    ;

PValue
    : NUMBER
        {$$ = +yytext;}
    | BOOL
        {$$ = yytext === 'yes';}
    | 'hsv' '{' NUMBER NUMBER NUMBER '}'
        {$$ = { h: +$3, s: +$4, v: +$5 };}
    | 'rgb' '{' NUMBER NUMBER NUMBER '}'
        {$$ = { r: +$3, g: +$4, b: +$5 };}
    | QIDENTIFIER
        {$$ = yytext;}
    | IDENTIFIER
        {$$ = yytext;}
    | DATE
        {$$ = toDate(yytext);}
    | QDATE
        {$$ = toDate(yytext);}
    | '{' PMemberList '}'
        {$$ = obj; obj = nest.pop();}
    | '{' PList '}'
        {$$ = obj; obj = nest.pop();}
    ;

%%

nest = [];
obj = {};
