import pandas as pd

file_path = r"c:\Users\cerqu\Documents\Projetos_IDE\MetaScale\public\references\Cópia de SIMULAÇÃO - PRINCÍPIO 80x10x10 (ALUNOS).xlsx"

df = pd.read_excel(file_path, sheet_name=0)
print(df.to_string())
