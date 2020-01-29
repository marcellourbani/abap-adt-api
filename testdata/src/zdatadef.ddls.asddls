@AbapCatalog.sqlViewName: 'ZDATADEF_SV'
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'foo'
@Metadata.allowExtensions: true
define view zdatadef as select from e070 {
    trkorr,
    korrdev,
    as4user ,
      cast(
  case trstatus
    when 'R' then 'X'
    when 'N' then 'X'
    else ' '
  end as flag ) 
  as isreleased
    
}
