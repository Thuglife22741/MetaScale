import pandas as pd

file_path = r"c:\Users\cerqu\Documents\Projetos_IDE\MetaScale\public\references\Cópia de SIMULAÇÃO - PRINCÍPIO 80x10x10 (ALUNOS).xlsx"

# Read all sheets
all_sheets = pd.read_excel(file_path, sheet_name=None)

for sheet_name, df in all_sheets.items():
    print(f"\n--- Sheet: {sheet_name} ---")
    print(df.head(15).to_string())
    print(df.info())
