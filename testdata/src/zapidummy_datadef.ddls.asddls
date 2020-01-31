@AbapCatalog.sqlViewName: 'ZAPIDUMMY_DDEFSV'
@AbapCatalog.compiler.compareFilter: true
@AbapCatalog.preserveKey: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'data definition test'
@Metadata.allowExtensions: true
define view ZAPIDUMMY_datadef as select from e070 {
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
